import { soundEngine } from './audio';
import { CHARACTERS, INITIAL_UNLOCKED_CHARACTERS } from './characters';
import { BOSS_CONFIGS, LEVELS } from './levels';
import {
  getPulsingFirePhase,
  getPulsingTrapPhase,
  renderGameScene,
} from './renderer';
import {
  BossProjectile,
  BossState,
  BrakePart,
  ChalkConstruct,
  CharacterId,
  CinematicState,
  DogCompanion,
  Enemy,
  EnemyProjectile,
  FluidBottle,
  GamePhase,
  HazardZone,
  HeartPickup,
  HudSnapshot,
  LevelDefinition,
  Particle,
  Platform,
  PlayerState,
  PopBurst,
  RewindSample,
  RopeNode,
  RopeState,
  SonicWave,
  WindZone,
} from './types';
import { WebGLPostProcessor } from './webglShader';

// Constantes físicas calibradas para resolución 1280x720 HD
const VIRTUAL_H = 720;
const GRAVITY = 1920;
const BASE_MOVE_SPEED = 368;
const CROUCH_MOVE_SPEED = 172;
const BASE_JUMP_VELOCITY = -775;
const BOUNCE_VELOCITY = -1100;
const MAX_FALL_SPEED = 1120;
const FLUID_PER_BOTTLE = 9;

const PLAYER_W = 42;
const STAND_H = 76;
const CROUCH_H = 46;

const STORAGE_KEY_COMPLETED = 'frenar_game_completed_v1';

const ALL_CHARACTER_IDS: CharacterId[] = [
  'rodolfo',
  'marcela',
  'micaela',
  'lautaro',
  'leandro',
  'gustavo',
];

export class GameEngine {
  private displayCanvas: HTMLCanvasElement;
  private sceneCanvas: HTMLCanvasElement;
  private sceneCtx: CanvasRenderingContext2D;
  private shader: WebGLPostProcessor;
  private onHudUpdate: (snapshot: HudSnapshot) => void;

  private phase: GamePhase = 'CHARACTER_SELECT';
  private characterId: CharacterId = 'rodolfo';
  private gameCompleted = false;
  private unlockedCharacters: CharacterId[] = [...INITIAL_UNLOCKED_CHARACTERS];
  private newlyUnlockedCharacter: CharacterId | null = null;

  private levelIndex = 0;
  private lives = 4;
  private maxLives = 4;
  private score = 0;
  private bottlesCollectedTotal = 0;
  private enemiesDefeatedTotal = 0;

  private time = 0;
  private lastFrameTime = 0;
  private rafId: number | null = null;
  private hudSyncTimer = 0;

  private cameraX = 0;
  private shakeIntensity = 0;
  private shakeX = 0;
  private shakeY = 0;
  private shaderImpact = 0;

  private level!: LevelDefinition;
  private platforms: Platform[] = [];
  private hazards: HazardZone[] = [];
  private ropes: RopeState[] = [];
  private windZones: WindZone[] = [];
  private bottles: FluidBottle[] = [];
  private hearts: HeartPickup[] = [];
  private parts: BrakePart[] = [];
  private enemies: Enemy[] = [];
  private enemyProjectiles: EnemyProjectile[] = [];
  private boss: BossState | null = null;
  private bossDefeated = false;
  private bossProjectiles: BossProjectile[] = [];
  private bossBottleRespawnTimer = 0;

  private chalks: ChalkConstruct[] = [];
  private sonicWaves: SonicWave[] = [];
  private particles: Particle[] = [];
  private popBursts: PopBurst[] = [];
  private rewindHistory: RewindSample[] = [];
  private rewindSampleTimer = 0;

  private powerFeedback: string | null = null;
  private powerFeedbackTimer = 0;

  private swapsRemainingThisLevel = 1;
  private returnPhaseAfterSelect: GamePhase = 'PLAYING';

  private cinematic: CinematicState = {
    active: false,
    elapsed: 0,
    duration: 14.5,
    liftProgress: 0,
    fadeBlack: 0,
    caption: '',
    showTheEnd: false,
  };

  private dog: DogCompanion = {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    facing: 1,
    timer: 0,
    maxTimer: 5.5,
    attackCooldown: 0,
    lungeTimer: 0,
    animTime: 0,
  };

  private player!: PlayerState;

  private keys = new Set<string>();
  private jumpPressedThisFrame = false;
  private powerPressedThisFrame = false;
  private shakeKeyPressedThisFrame = false;

  constructor(
    canvas: HTMLCanvasElement,
    onHudUpdate: (snapshot: HudSnapshot) => void
  ) {
    this.displayCanvas = canvas;
    this.shader = new WebGLPostProcessor(canvas);

    this.sceneCanvas = document.createElement('canvas');
    this.sceneCanvas.width = Math.max(960, canvas.width || 1280);
    this.sceneCanvas.height = Math.max(540, canvas.height || 720);
    const ctx = this.sceneCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo inicializar el contexto 2D auxiliar.');
    }
    this.sceneCtx = ctx;
    this.sceneCtx.imageSmoothingEnabled = true;
    this.onHudUpdate = onHudUpdate;

    this.gameCompleted = this.readCompletedFlag();
    this.unlockedCharacters = this.gameCompleted
      ? [...ALL_CHARACTER_IDS]
      : [...INITIAL_UNLOCKED_CHARACTERS];

    this.loadLevel(0, true);
    this.bindInput();
    this.emitHud();
  }

  private readCompletedFlag(): boolean {
    try {
      return window.localStorage.getItem(STORAGE_KEY_COMPLETED) === 'true';
    } catch {
      return false;
    }
  }

  private writeCompletedFlag(completed: boolean): void {
    try {
      if (completed) {
        window.localStorage.setItem(STORAGE_KEY_COMPLETED, 'true');
      } else {
        window.localStorage.removeItem(STORAGE_KEY_COMPLETED);
      }
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }

  private bindInput(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('pointerdown', this.handlePointerDown);
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('pointerdown', this.handlePointerDown);
  }

  private handlePointerDown = (): void => {
    soundEngine.unlock();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (
      [
        'Space',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ].includes(code)
    ) {
      e.preventDefault();
    }

    soundEngine.unlock();

    if (!this.keys.has(code)) {
      if (
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'KeyA' ||
        code === 'KeyD' ||
        code === 'Space' ||
        code === 'ArrowUp' ||
        code === 'KeyW' ||
        code === 'ArrowDown' ||
        code === 'KeyS'
      ) {
        this.shakeKeyPressedThisFrame = true;
      }
      if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
        this.jumpPressedThisFrame = true;
      }
      if (
        code === 'KeyE' ||
        code === 'ShiftLeft' ||
        code === 'ShiftRight'
      ) {
        this.powerPressedThisFrame = true;
      }
      if (code === 'KeyP' || code === 'Escape') {
        if (this.phase === 'PLAYING') {
          this.setPhase('PAUSED');
        } else if (this.phase === 'PAUSED') {
          this.setPhase('PLAYING');
        }
      }
      if (code === 'KeyR' && this.phase === 'PLAYING') {
        this.restartCurrentLevel();
      }
      if (code === 'KeyM') {
        this.toggleMute();
      }
      if (e.key === '+' || code === 'Equal' || code === 'NumpadAdd') {
        this.stepMusicVolume(0.1);
      }
      if (e.key === '-' || code === 'Minus' || code === 'NumpadSubtract') {
        this.stepMusicVolume(-0.1);
      }
    }

    this.keys.add(code);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  public startLoop(): void {
    this.lastFrameTime = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;
      const dt = Math.min(rawDt, 0.045);

      this.update(dt);
      this.render();

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public startNewGame(characterId: CharacterId): void {
    soundEngine.unlock();
    this.unlockedCharacters = this.gameCompleted
      ? [...ALL_CHARACTER_IDS]
      : [...INITIAL_UNLOCKED_CHARACTERS];
    this.newlyUnlockedCharacter = null;
    this.characterId = this.unlockedCharacters.includes(characterId)
      ? characterId
      : 'rodolfo';
    this.lives = this.maxLives;
    this.score = 0;
    this.bottlesCollectedTotal = 0;
    this.enemiesDefeatedTotal = 0;
    this.cinematic.active = false;
    this.cinematic.fadeBlack = 0;
    this.loadLevel(0, true);
    this.phase = 'PLAYING';
    this.emitHud();
  }

  public resetProgress(): void {
    soundEngine.unlock();
    this.writeCompletedFlag(false);
    this.gameCompleted = false;
    this.unlockedCharacters = [...INITIAL_UNLOCKED_CHARACTERS];
    this.newlyUnlockedCharacter = null;
    this.characterId = 'rodolfo';
    this.lives = this.maxLives;
    this.score = 0;
    this.bottlesCollectedTotal = 0;
    this.enemiesDefeatedTotal = 0;
    this.cinematic.active = false;
    this.cinematic.fadeBlack = 0;
    this.loadLevel(0, true);
    this.phase = 'CHARACTER_SELECT';
    this.keys.clear();
    this.emitHud();
  }

  public selectCharacterMidGame(characterId: CharacterId): void {
    if (!this.unlockedCharacters.includes(characterId)) return;
    soundEngine.unlock();

    if (this.phase === 'GAME_OVER') {
      this.lives = this.maxLives;
      this.loadLevel(this.levelIndex, false);
      this.characterId = characterId;
      this.phase = 'PLAYING';
      this.spawnPopBurst(
        this.player.x + this.player.w / 2,
        this.player.y - 22,
        CHARACTERS[characterId].name.toUpperCase(),
        CHARACTERS[characterId].primaryColor
      );
      this.emitHud();
      return;
    }

    if (
      characterId === this.characterId &&
      this.phase !== 'FINAL_BOSS_SELECT' &&
      this.phase !== 'BOSS_VICTORY'
    ) {
      this.phase =
        this.returnPhaseAfterSelect === 'LEVEL_COMPLETE'
          ? 'LEVEL_COMPLETE'
          : 'PLAYING';
      this.emitHud();
      return;
    }

    const isFreeSwap =
      this.phase === 'FINAL_BOSS_SELECT' ||
      this.phase === 'BOSS_VICTORY' ||
      this.bossDefeated;

    if (!isFreeSwap && this.swapsRemainingThisLevel <= 0) {
      soundEngine.playNoFluid();
      this.setPowerFeedback('Cambio usado en esta pantalla (0/1)');
      this.phase =
        this.returnPhaseAfterSelect === 'LEVEL_COMPLETE'
          ? 'LEVEL_COMPLETE'
          : 'PLAYING';
      this.emitHud();
      return;
    }

    if (!isFreeSwap) {
      this.swapsRemainingThisLevel = Math.max(
        0,
        this.swapsRemainingThisLevel - 1
      );
    }

    this.characterId = characterId;
    this.player.powerTimer = 0;
    this.player.powerCooldown = 0;
    this.player.isSleepingInBed = false;
    this.player.isIdleScene = false;
    this.player.idleTime = 0;
    this.player.carRewindTimer = 0;
    this.player.frozenTimer = 0;
    this.player.frozenCooldown = 0;
    this.player.frozenShakeCount = 0;
    this.player.updraftLaunched = false;
    this.player.fallPeakY = this.player.y;
    this.player.celebrateTimer = 0.6;
    this.dog.active = false;
    this.rewindHistory = [];
    this.spawnPopBurst(
      this.player.x + this.player.w / 2,
      this.player.y - 22,
      CHARACTERS[characterId].name.toUpperCase(),
      CHARACTERS[characterId].primaryColor
    );

    if (
      this.phase === 'FINAL_BOSS_SELECT' ||
      this.phase === 'BOSS_VICTORY' ||
      this.phase === 'PAUSED'
    ) {
      this.phase = 'PLAYING';
    } else if (this.phase === 'CHARACTER_SELECT') {
      this.phase =
        this.returnPhaseAfterSelect === 'LEVEL_COMPLETE'
          ? 'LEVEL_COMPLETE'
          : 'PLAYING';
    }
    this.emitHud();
  }

  public setPhase(phase: GamePhase): void {
    this.phase = phase;
    this.keys.clear();
    this.emitHud();
  }

  public openCharacterSelect(): void {
    if (
      this.phase !== 'GAME_OVER' &&
      this.phase !== 'FINAL_BOSS_SELECT' &&
      !this.bossDefeated &&
      this.swapsRemainingThisLevel <= 0
    ) {
      soundEngine.playNoFluid();
      this.setPowerFeedback('Cambio usado en esta pantalla (0/1)');
      this.emitHud();
      return;
    }
    this.returnPhaseAfterSelect = this.phase;
    this.phase = 'CHARACTER_SELECT';
    this.keys.clear();
    this.emitHud();
  }

  public resumeFromCharacterSelect(): void {
    if (this.returnPhaseAfterSelect === 'LEVEL_COMPLETE') {
      this.phase = 'LEVEL_COMPLETE';
    } else if (this.returnPhaseAfterSelect === 'BOSS_VICTORY') {
      this.phase = 'BOSS_VICTORY';
    } else if (this.returnPhaseAfterSelect === 'GAME_OVER') {
      this.phase = 'GAME_OVER';
    } else {
      this.phase = 'PLAYING';
    }
    this.keys.clear();
    this.emitHud();
  }

  public nextLevel(): void {
    this.newlyUnlockedCharacter = null;
    if (this.levelIndex + 1 < LEVELS.length) {
      const nextIdx = this.levelIndex + 1;
      this.loadLevel(nextIdx, false);
      this.returnPhaseAfterSelect = 'PLAYING';
      if (this.level.isBossArena && this.boss?.isFinalBoss) {
        this.phase = 'FINAL_BOSS_SELECT';
      } else {
        this.phase = 'PLAYING';
      }
      this.emitHud();
    } else {
      this.startCinematic();
    }
  }

  public restartCurrentLevel(): void {
    const keepLives = Math.max(2, this.lives);
    this.lives = keepLives;
    this.cinematic.active = false;
    this.cinematic.fadeBlack = 0;
    this.loadLevel(this.levelIndex, false);
    this.phase = 'PLAYING';
    this.emitHud();
  }

  public triggerPowerFromUI(): void {
    if (this.phase === 'PLAYING') {
      soundEngine.unlock();
      this.powerPressedThisFrame = true;
    }
  }

  public toggleMute(): void {
    soundEngine.unlock();
    soundEngine.setMuted(!soundEngine.isMuted());
    this.emitHud();
  }

  public setMusicVolumePercent(percent: number): void {
    soundEngine.unlock();
    soundEngine.setMusicVolume(percent / 100);
    this.emitHud();
  }

  public stepMusicVolume(delta: number): void {
    soundEngine.unlock();
    soundEngine.stepMusicVolume(delta);
    this.emitHud();
  }

  private loadLevel(index: number, resetFluid: boolean): void {
    const def = LEVELS[index];
    this.levelIndex = index;
    this.level = def;
    this.bossDefeated = false;
    this.swapsRemainingThisLevel = 1;
    this.returnPhaseAfterSelect = 'PLAYING';

    this.platforms = def.platforms.map((p) => ({
      ...p,
      baseX: p.x,
      baseY: p.y,
      dx: 0,
      dy: 0,
      broken: false,
      bounceCompression: 0,
    }));

    this.hazards = def.hazards.map((h) => ({ ...h }));
    this.ropes = (def.ropes ?? []).map((r) => {
      const segCount = 8;
      const nodes: RopeNode[] = [];
      for (let i = 0; i <= segCount; i++) {
        const ny = r.anchorY + (r.length * i) / segCount;
        nodes.push({ x: r.x, y: ny, oldX: r.x, oldY: ny });
      }
      return { ...r, nodes };
    });
    this.windZones = (def.windZones ?? []).map((wz) => ({ ...wz }));

    this.bottles = def.bottles.map((b, i) => ({
      ...b,
      collected: false,
      bobPhase: i * 0.65,
    }));

    this.hearts = (def.hearts ?? []).map((ht, i) => ({
      ...ht,
      collected: false,
      bobPhase: i * 0.9,
    }));

    this.parts = def.parts.map((pt, i) => ({
      ...pt,
      collected: false,
      bobPhase: i * 1.1,
    }));

    this.enemies = def.enemies.map((e, i) => ({
      ...e,
      baseY: e.y,
      baseVx: Math.abs(e.vx),
      vy: 0,
      alive: true,
      animTime: i * 0.7,
      stunTimer: 0,
      aiState: 'patrol',
      aiTimer: 0,
      attackCooldown: 0.7 + i * 0.25,
    }));

    this.enemyProjectiles = [];
    this.bossProjectiles = [];
    this.bossBottleRespawnTimer = 0;
    if (def.isBossArena && def.bossId) {
      const cfg = BOSS_CONFIGS[def.bossId];
      this.boss = {
        active: true,
        id: cfg.id,
        name: cfg.name,
        subtitle: cfg.subtitle,
        x: 940,
        y: 600 - cfg.h,
        w: cfg.w,
        h: cfg.h,
        vx: 0,
        vy: 0,
        facing: -1,
        hp: cfg.maxHp,
        maxHp: cfg.maxHp,
        state: 'idle',
        stateTimer: 1.0,
        attackPattern: 0,
        invulnTimer: 0,
        animTime: 0,
        headFireActive: true,
        unlocksCharacter: cfg.unlocksCharacter,
        isFinalBoss: cfg.isFinalBoss,
        phase: 1,
        transformTimer: 0,
        speechText: cfg.isFinalBoss ? '¡Apurate que tengo turno!' : null,
        speechTimer: cfg.isFinalBoss ? 2.4 : 0,
        speechCooldown: 2.2,
      };
    } else {
      this.boss = null;
    }

    this.chalks = [];
    this.sonicWaves = [];
    this.particles = [];
    this.popBursts = [];
    this.rewindHistory = [];
    this.dog.active = false;
    this.powerFeedback = null;
    this.shaderImpact = 0;

    const currentFluid = resetFluid
      ? 48
      : Math.max(44, this.player ? this.player.fluid : 48);

    this.player = {
      x: def.spawnX,
      y: def.spawnY,
      w: PLAYER_W,
      h: STAND_H,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      groundSurface: 'asphalt',
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      invulnTimer: 0.9,
      hurtAnimTimer: 0,
      celebrateTimer: 0,
      fluid: currentFluid,
      maxFluid: 100,
      powerTimer: 0,
      powerCooldown: 0,
      powerMaxCooldown: 1,
      guitarShootTimer: 0,
      dashDir: 1,
      squashX: 1,
      squashY: 1,
      walkCycle: 0,
      idleTime: 0,
      isCrouching: false,
      dropThroughTimer: 0,
      isSleepingInBed: false,
      isIdleScene: false,
      idleClientChar: 'gustavo',
      grabbedRopeId: null,
      ropeAngle: 0,
      ropeAngularVel: 0,
      ropeDist: 200,
      ropeCooldown: 0,
      carRewindTimer: 0,
      carRewindDuration: 0.52,
      carRewindPath: [],
      frozenTimer: 0,
      frozenMaxTimer: 1.85,
      frozenCooldown: 0,
      frozenShakeCount: 0,
      updraftLaunched: false,
      fallPeakY: def.spawnY,
      lastSafeX: def.spawnX,
      lastSafeY: def.spawnY,
    };

    this.cameraX = 0;
  }

  private startCinematic(): void {
    this.gameCompleted = true;
    this.unlockedCharacters = [...ALL_CHARACTER_IDS];
    this.writeCompletedFlag(true);

    this.phase = 'CINEMATIC';
    this.keys.clear();
    this.cinematic = {
      active: true,
      elapsed: 0,
      duration: 14.5,
      liftProgress: 0,
      fadeBlack: 0,
      caption: 'Subiendo el auto al elevador hidráulico de FRENAR®...',
      showTheEnd: false,
    };
    soundEngine.playVictory();
    this.emitHud();
  }

  private update(dt: number): void {
    this.time += dt;

    if (this.shaderImpact > 0.01) {
      this.shaderImpact = Math.max(0, this.shaderImpact - dt * 2.4);
    } else {
      this.shaderImpact = 0;
    }

    if (this.shakeIntensity > 0.1) {
      this.shakeIntensity *= Math.pow(0.015, dt);
      this.shakeX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
    } else {
      this.shakeIntensity = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }

    if (this.phase === 'CINEMATIC') {
      this.updateCinematic(dt);
      return;
    }

    if (this.phase !== 'PLAYING') {
      this.jumpPressedThisFrame = false;
      this.powerPressedThisFrame = false;
      this.shakeKeyPressedThisFrame = false;
      return;
    }

    if (this.powerFeedbackTimer > 0) {
      this.powerFeedbackTimer -= dt;
      if (this.powerFeedbackTimer <= 0) {
        this.powerFeedback = null;
      }
    }

    this.updatePlatforms(dt);
    this.updateChalks(dt);
    this.updatePlayer(dt);
    this.updateRopes(dt);
    this.updateDog(dt);
    this.updateSonicWaves(dt);
    this.updateEnemies(dt);
    this.updateEnemyProjectiles(dt);
    this.updateBoss(dt);
    this.updateBossProjectiles(dt);
    this.checkHazards(dt);
    this.checkCollectibles();
    this.checkGoal();
    this.spawnWindAmbientParticles();
    this.spawnTrapParticles();
    this.updateParticles(dt);
    this.updateCamera(dt);

    this.jumpPressedThisFrame = false;
    this.powerPressedThisFrame = false;
    this.shakeKeyPressedThisFrame = false;

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.06) {
      this.hudSyncTimer = 0;
      this.emitHud();
    }
  }

  private getWindAt(x: number, y: number): number {
    let total = this.level.ambientWindX ?? 0;
    for (const wz of this.windZones) {
      if (x >= wz.x && x <= wz.x + wz.w && y >= wz.y && y <= wz.y + wz.h) {
        total += wz.forceX;
      }
    }
    return total;
  }

  private spawnWindAmbientParticles(): void {
    const ambient = this.level.ambientWindX ?? 0;
    if (ambient !== 0 && Math.random() < 0.28) {
      const dir = ambient >= 0 ? 1 : -1;
      const color =
        this.level.palette.season === 'autumn'
          ? Math.random() < 0.55
            ? '#FB923C'
            : '#FACC15'
          : '#E0F2FE';
      this.particles.push({
        x: this.cameraX + (dir > 0 ? -20 : 1320),
        y: 90 + Math.random() * 480,
        vx: ambient * 2.2,
        vy: 15 + Math.random() * 25,
        size: this.level.palette.season === 'autumn' ? 5.2 : 3.6,
        color,
        life: 1.5,
        maxLife: 1.5,
        shape: 'circle',
        rotation: 0,
        rotSpeed: 0,
        gravity: 8,
      });
    }

    for (const wz of this.windZones) {
      if (Math.random() < 0.35) {
        const dir = wz.forceX >= 0 ? 1 : -1;
        this.particles.push({
          x: wz.x + (dir > 0 ? 6 : wz.w - 6),
          y: wz.y + 18 + Math.random() * Math.max(20, wz.h - 36),
          vx: wz.forceX * 1.15,
          vy: (Math.random() - 0.5) * 35,
          size: this.level.palette.season === 'autumn' ? 4.8 : 3.8,
          color:
            this.level.palette.season === 'autumn' ? '#FDBA74' : '#BAE6FD',
          life: Math.min(1.1, wz.w / Math.max(140, Math.abs(wz.forceX))),
          maxLife: 1.1,
          shape: 'circle',
          rotation: 0,
          rotSpeed: 0,
          gravity: 0,
        });
      }
    }
  }

  private spawnTrapParticles(): void {
    for (const h of this.hazards) {
      if (h.x + h.w < this.cameraX - 120 || h.x > this.cameraX + 1420) continue;

      if (h.type === 'fire' && h.isSprinkler) {
        const phase = getPulsingFirePhase(h, this.time);
        const dir = h.direction ?? 'up';

        if (phase.state === 'active' && Math.random() < 0.72) {
          const px =
            dir === 'left'
              ? h.x + h.w - 14 - Math.random() * h.w * 0.65
              : dir === 'right'
                ? h.x + 14 + Math.random() * h.w * 0.65
                : h.x + 10 + Math.random() * Math.max(10, h.w - 20);
          const py =
            dir === 'up'
              ? h.y + h.h - 20 - Math.random() * h.h * 0.7
              : dir === 'down'
                ? h.y + 20 + Math.random() * h.h * 0.7
                : h.y + 18 + Math.random() * Math.max(20, h.h - 36);
          const vx =
            dir === 'right'
              ? 240 + Math.random() * 140
              : dir === 'left'
                ? -(240 + Math.random() * 140)
                : (Math.random() - 0.5) * 65;
          const vy =
            dir === 'up'
              ? -(260 + Math.random() * 160)
              : dir === 'down'
                ? 260 + Math.random() * 160
                : (Math.random() - 0.5) * 55;

          this.particles.push({
            x: px,
            y: py,
            vx,
            vy,
            size: 3.5 + Math.random() * 3.5,
            color:
              Math.random() < 0.45
                ? '#FEF08A'
                : Math.random() < 0.75
                  ? '#F97316'
                  : '#EF4444',
            life: 0.34,
            maxLife: 0.34,
            shape: 'circle',
            rotation: 0,
            rotSpeed: 0,
            gravity: dir === 'up' || dir === 'down' ? 0 : 80,
          });
        } else if (phase.state === 'warning' && Math.random() < 0.35) {
          const px =
            dir === 'left'
              ? h.x + h.w - 8
              : dir === 'right'
                ? h.x + 8
                : h.x + 14 + Math.random() * Math.max(10, h.w - 28);
          const py =
            dir === 'up'
              ? h.y + h.h - 10
              : dir === 'down'
                ? h.y + 10
                : h.y + 22 + Math.random() * Math.max(20, h.h - 44);
          this.particles.push({
            x: px,
            y: py,
            vx:
              dir === 'right'
                ? 140
                : dir === 'left'
                  ? -140
                  : (Math.random() - 0.5) * 50,
            vy:
              dir === 'up'
                ? -140
                : dir === 'down'
                  ? 140
                  : (Math.random() - 0.5) * 40,
            size: 3.2,
            color: '#FACC15',
            life: 0.24,
            maxLife: 0.24,
            shape: 'circle',
            rotation: 0,
            rotSpeed: 0,
            gravity: 40,
          });
        }
      } else if (h.type === 'ice_column') {
        const phase = getPulsingTrapPhase(h, this.time);
        const dir = h.direction ?? 'up';

        if (phase.state === 'active' && Math.random() < 0.65) {
          const px =
            dir === 'left'
              ? h.x + h.w - 14 - Math.random() * h.w * 0.65
              : dir === 'right'
                ? h.x + 14 + Math.random() * h.w * 0.65
                : h.x + 10 + Math.random() * Math.max(10, h.w - 20);
          const py =
            dir === 'up'
              ? h.y + h.h - 18 - Math.random() * h.h * 0.7
              : dir === 'down'
                ? h.y + 18 + Math.random() * h.h * 0.7
                : h.y + 16 + Math.random() * Math.max(20, h.h - 32);
          this.particles.push({
            x: px,
            y: py,
            vx:
              dir === 'right'
                ? 210 + Math.random() * 110
                : dir === 'left'
                  ? -(210 + Math.random() * 110)
                  : (Math.random() - 0.5) * 70,
            vy:
              dir === 'up'
                ? -(220 + Math.random() * 140)
                : dir === 'down'
                  ? 220 + Math.random() * 140
                  : (Math.random() - 0.5) * 60,
            size: 3.2 + Math.random() * 3.4,
            color:
              Math.random() < 0.45
                ? '#FFFFFF'
                : Math.random() < 0.78
                  ? '#A5F3FC'
                  : '#38BDF8',
            life: 0.36,
            maxLife: 0.36,
            shape: 'circle',
            rotation: 0,
            rotSpeed: 0,
            gravity: 45,
          });
        } else if (phase.state === 'warning' && Math.random() < 0.32) {
          const px =
            dir === 'left'
              ? h.x + h.w - 8
              : dir === 'right'
                ? h.x + 8
                : h.x + 14 + Math.random() * Math.max(10, h.w - 28);
          const py =
            dir === 'up'
              ? h.y + h.h - 10
              : dir === 'down'
                ? h.y + 10
                : h.y + 20 + Math.random() * Math.max(20, h.h - 40);
          this.particles.push({
            x: px,
            y: py,
            vx:
              dir === 'right'
                ? 110
                : dir === 'left'
                  ? -110
                  : (Math.random() - 0.5) * 45,
            vy:
              dir === 'up'
                ? -115
                : dir === 'down'
                  ? 115
                  : (Math.random() - 0.5) * 35,
            size: 3.4,
            color: '#BAE6FD',
            life: 0.28,
            maxLife: 0.28,
            shape: 'circle',
            rotation: 0,
            rotSpeed: 0,
            gravity: 25,
          });
        }
      } else if (h.type === 'updraft') {
        const phase = getPulsingTrapPhase(h, this.time);
        if (phase.state === 'active' && Math.random() < 0.78) {
          this.particles.push({
            x: h.x + 10 + Math.random() * Math.max(10, h.w - 20),
            y: h.y + h.h - 8 - Math.random() * 35,
            vx: (Math.random() - 0.5) * 38,
            vy: -(480 + Math.random() * 240),
            size: 3.2 + Math.random() * 2.8,
            color: Math.random() < 0.5 ? '#FFFFFF' : '#7DD3FC',
            life: 0.55,
            maxLife: 0.55,
            shape: 'circle',
            rotation: 0,
            rotSpeed: 0,
            gravity: -60,
          });
        } else if (phase.state === 'warning' && Math.random() < 0.35) {
          this.particles.push({
            x: h.x + 14 + Math.random() * Math.max(10, h.w - 28),
            y: h.y + h.h - 8,
            vx: (Math.random() - 0.5) * 30,
            vy: -150 - Math.random() * 60,
            size: 3,
            color: '#FDE047',
            life: 0.26,
            maxLife: 0.26,
            shape: 'circle',
            rotation: 0,
            rotSpeed: 0,
            gravity: 0,
          });
        }
      } else if (h.type === 'suction') {
        const phase = getPulsingTrapPhase(h, this.time);
        if (phase.state === 'active' && Math.random() < 0.75) {
          const pitCx = h.x + h.w / 2;
          const sx = h.x + 6 + Math.random() * Math.max(10, h.w - 12);
          this.particles.push({
            x: sx,
            y: h.y + 12 + Math.random() * (h.h * 0.52),
            vx: (pitCx - sx) * 1.8,
            vy: 340 + Math.random() * 220,
            size: 3.4 + Math.random() * 2.6,
            color: Math.random() < 0.55 ? '#C084FC' : '#38BDF8',
            life: 0.44,
            maxLife: 0.44,
            shape: 'circle',
            rotation: 0,
            rotSpeed: 0,
            gravity: 160,
          });
        } else if (phase.state === 'warning' && Math.random() < 0.34) {
          const pitCx = h.x + h.w / 2;
          const sx = h.x + 10 + Math.random() * Math.max(10, h.w - 20);
          this.particles.push({
            x: sx,
            y: 525 + Math.random() * 60,
            vx: (pitCx - sx) * 1.2,
            vy: 120 + Math.random() * 60,
            size: 3,
            color: '#E879F9',
            life: 0.28,
            maxLife: 0.28,
            shape: 'circle',
            rotation: 0,
            rotSpeed: 0,
            gravity: 60,
          });
        }
      }
    }
  }

  private updateCinematic(dt: number): void {
    const cin = this.cinematic;
    cin.elapsed += dt;
    const t = cin.elapsed;

    if (t < 2.4) {
      cin.liftProgress = Math.min(1, t / 2.4);
      cin.caption = 'Subiendo el auto al elevador hidráulico de FRENAR®...';
    } else if (t < 7.2) {
      cin.liftProgress = 1;
      cin.caption =
        'Rodolfo ajusta frenos con su llave, Leandro saca la rueda y Marcela anota todo.';
    } else if (t < 10.5) {
      cin.liftProgress = Math.max(0, 1 - (t - 7.2) / 1.4);
      cin.caption = '¡Frenos reparados! Todo el equipo saluda en FRENAR®.';
    } else {
      cin.liftProgress = 0;
      cin.showTheEnd = true;
      cin.caption = '';
    }

    if (t >= 11.8) {
      cin.fadeBlack = Math.min(1, (t - 11.8) / 2.4);
    }

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.1) {
      this.hudSyncTimer = 0;
      this.emitHud();
    }

    if (t >= cin.duration) {
      cin.active = false;
      cin.fadeBlack = 0;
      this.phase = 'VICTORY';
      this.emitHud();
    }
  }

  private updatePlatforms(dt: number): void {
    for (const p of this.platforms) {
      if (p.broken) continue;
      if (p.bounceCompression && p.bounceCompression > 0) {
        p.bounceCompression = Math.max(0, p.bounceCompression - dt * 5);
      }
      if (p.kind === 'moving') {
        const prevY = p.y;
        const offset =
          Math.sin(
            this.time * (p.moveSpeed ?? 1.5) + (p.phaseOffset ?? 0)
          ) * (p.moveRange ?? 36);
        p.y = p.baseY + offset;
        p.dx = 0;
        p.dy = p.y - prevY;
      } else {
        p.dx = 0;
        p.dy = 0;
      }
    }
  }

  private updateChalks(dt: number): void {
    for (const ch of this.chalks) {
      ch.timer -= dt;
    }
    this.chalks = this.chalks.filter((ch) => ch.timer > 0);
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    const spec = CHARACTERS[this.characterId];

    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    if (p.hurtAnimTimer > 0)
      p.hurtAnimTimer = Math.max(0, p.hurtAnimTimer - dt);
    if (p.celebrateTimer > 0)
      p.celebrateTimer = Math.max(0, p.celebrateTimer - dt);
    if (p.powerCooldown > 0)
      p.powerCooldown = Math.max(0, p.powerCooldown - dt);
    if (p.dropThroughTimer > 0)
      p.dropThroughTimer = Math.max(0, p.dropThroughTimer - dt);
    if (p.ropeCooldown > 0)
      p.ropeCooldown = Math.max(0, p.ropeCooldown - dt);
    if (p.frozenCooldown > 0)
      p.frozenCooldown = Math.max(0, p.frozenCooldown - dt);

    // Animación de Renault 19 rebobinando
    if (p.carRewindTimer > 0) {
      p.carRewindTimer = Math.max(0, p.carRewindTimer - dt);
      const progress = 1 - p.carRewindTimer / p.carRewindDuration;
      if (p.carRewindPath.length > 0) {
        const idx = Math.min(
          p.carRewindPath.length - 1,
          Math.floor(progress * (p.carRewindPath.length - 1))
        );
        const sample = p.carRewindPath[idx];
        p.x = sample.x;
        p.y = sample.y;
        p.facing = sample.facing;
      }
      if (Math.random() < 0.85) {
        this.particles.push({
          x: p.x + p.w / 2 + (Math.random() - 0.5) * 44,
          y: p.y + p.h - 4,
          vx: (Math.random() - 0.5) * 110,
          vy: -32 - Math.random() * 50,
          size: 5.5,
          color: Math.random() < 0.65 ? '#00D4FF' : '#FFE600',
          life: 0.32,
          maxLife: 0.32,
          shape: 'star',
          rotation: 0,
          rotSpeed: 0,
          gravity: 130,
        });
      }
      if (p.carRewindTimer <= 0) {
        p.vx = 0;
        p.vy = 0;
        this.rewindHistory = [];
      }
      return;
    }

    // Jugador congelado dentro de un bloque de hielo (agitando controles rompe el hielo más rápido)
    if (p.frozenTimer > 0) {
      p.grabbedRopeId = null;
      p.isIdleScene = false;
      p.isSleepingInBed = false;
      p.idleTime = 0;
      p.vx = 0;
      p.frozenTimer = Math.max(0, p.frozenTimer - dt);

      if (this.shakeKeyPressedThisFrame) {
        p.frozenTimer = Math.max(0, p.frozenTimer - 0.26);
        p.frozenShakeCount += 1;
        this.shakeIntensity = Math.max(this.shakeIntensity, 2.8);
        for (let i = 0; i < 4; i++) {
          this.particles.push({
            x: p.x + p.w / 2 + (Math.random() - 0.5) * 28,
            y: p.y + p.h * 0.4 + (Math.random() - 0.5) * 32,
            vx: (Math.random() - 0.5) * 160,
            vy: -70 - Math.random() * 90,
            size: 4.2,
            color: i % 2 === 0 ? '#FFFFFF' : '#7DD3FC',
            life: 0.28,
            maxLife: 0.28,
            shape: 'circle',
            rotation: 0,
            rotSpeed: 0,
            gravity: 340,
          });
        }
      }

      p.vy = Math.min(MAX_FALL_SPEED, p.vy + GRAVITY * dt);
      const prevBottom = p.y + p.h;
      p.onGround = false;
      p.y += p.vy * dt;

      for (const box of this.getSolidColliders(false)) {
        if (this.rectsOverlap(p.x, p.y, p.w, p.h, box.x, box.y, box.w, box.h)) {
          if (p.vy >= 0 && (!box.oneWay || prevBottom <= box.y + 12)) {
            p.y = box.y - p.h;
            p.vy = 0;
            p.onGround = true;
            p.groundSurface = box.platformRef?.surface ?? 'asphalt';
            p.updraftLaunched = false;
            p.fallPeakY = p.y;
          } else if (p.vy < 0 && !box.oneWay) {
            p.y = box.y + box.h;
            p.vy = 0;
          }
        }
      }

      if (p.frozenTimer <= 0) {
        p.frozenCooldown = 0.85;
        p.frozenShakeCount = 0;
        soundEngine.playIceBreak();
        this.spawnExplosionParticles(
          p.x + p.w / 2,
          p.y + p.h / 2,
          '#7DD3FC',
          14
        );
        this.spawnPopBurst(p.x + p.w / 2, p.y - 18, '¡LIBRE!', '#38BDF8');
      }

      if (p.y > this.level.height + 100) {
        this.handlePitFall();
      }
      return;
    }

    if (this.powerPressedThisFrame) {
      this.tryActivatePower();
    }

    const isLeandroDashing =
      this.characterId === 'leandro' && p.powerTimer > 0;
    const isMicaelaFloating =
      this.characterId === 'micaela' && p.powerTimer > 0;

    if (p.powerTimer > 0) {
      p.powerTimer = Math.max(0, p.powerTimer - dt);

      if (this.characterId === 'gustavo') {
        p.guitarShootTimer -= dt;
        if (p.guitarShootTimer <= 0) {
          p.guitarShootTimer = 0.4;
          this.spawnSonicWave();
        }
      }

      if (isMicaelaFloating && Math.random() < 0.38) {
        this.particles.push({
          x: p.x + p.w / 2 + (Math.random() - 0.5) * 38,
          y: p.y + p.h + 4,
          vx: (Math.random() - 0.5) * 26,
          vy: 36 + Math.random() * 24,
          size: 5,
          color: '#FFD6EC',
          life: 0.42,
          maxLife: 0.42,
          shape: 'circle',
          rotation: 0,
          rotSpeed: 0,
          gravity: 0,
        });
      }
    }

    const left = this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    const right = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    const upHold =
      this.keys.has('ArrowUp') ||
      this.keys.has('KeyW') ||
      this.keys.has('Space');
    const downHold = this.keys.has('ArrowDown') || this.keys.has('KeyS');

    // Cancelación instantánea de animación idle al presionar cualquier control
    const anyWakeInput =
      left ||
      right ||
      upHold ||
      downHold ||
      this.jumpPressedThisFrame ||
      this.powerPressedThisFrame;
    if (anyWakeInput && (p.isSleepingInBed || p.isIdleScene)) {
      p.isSleepingInBed = false;
      p.isIdleScene = false;
      p.idleTime = 0;
    }

    // Gestión de AGACHARSE
    const wantCrouch = downHold && !isLeandroDashing && !isMicaelaFloating;

    if (wantCrouch && !p.isCrouching) {
      p.isCrouching = true;
      p.y += STAND_H - CROUCH_H;
      p.h = CROUCH_H;
    } else if (!wantCrouch && p.isCrouching) {
      const standY = p.y - (STAND_H - CROUCH_H);
      const blockedByCeiling = this.getSolidColliders(true).some((box) =>
        this.rectsOverlap(p.x, standY, p.w, STAND_H, box.x, box.y, box.w, box.h)
      );
      if (!blockedByCeiling) {
        p.isCrouching = false;
        p.y = standY;
        p.h = STAND_H;
      }
    }

    // Bajar de plataforma one-way con S/Abajo + Saltar
    if (downHold && this.jumpPressedThisFrame && p.onGround) {
      const standingOnOneWay = this.getSolidColliders(false).some(
        (box) =>
          box.oneWay &&
          p.x + p.w > box.x &&
          p.x < box.x + box.w &&
          Math.abs(p.y + p.h - box.y) <= 8
      );
      if (standingOnOneWay) {
        p.dropThroughTimer = 0.24;
        p.onGround = false;
        p.y += 6;
        this.jumpPressedThisFrame = false;
      }
    }

    // Física de balanceo en lianas y cables aéreos
    if (p.grabbedRopeId) {
      const rope = this.ropes.find((r) => r.id === p.grabbedRopeId);
      if (!rope || isLeandroDashing) {
        p.grabbedRopeId = null;
      } else {
        p.idleTime = 0;
        p.isIdleScene = false;
        p.isSleepingInBed = false;
        p.onGround = false;

        const gravityAcc =
          -((GRAVITY * 0.72) / Math.max(120, p.ropeDist)) *
          Math.sin(p.ropeAngle);
        let pumpAcc = 0;
        if (left) {
          pumpAcc -= 3.8;
          p.facing = -1;
        }
        if (right) {
          pumpAcc += 3.8;
          p.facing = 1;
        }
        const ropeWindX = this.getWindAt(p.x + p.w / 2, p.y + p.h / 2);
        p.ropeAngularVel += (gravityAcc + pumpAcc + ropeWindX * 0.0042) * dt;
        p.ropeAngularVel *= Math.pow(0.86, dt);
        p.ropeAngle += p.ropeAngularVel * dt;
        if (p.ropeAngle > 1.15) {
          p.ropeAngle = 1.15;
          p.ropeAngularVel = Math.min(0, p.ropeAngularVel);
        } else if (p.ropeAngle < -1.15) {
          p.ropeAngle = -1.15;
          p.ropeAngularVel = Math.max(0, p.ropeAngularVel);
        }

        p.x = Math.max(
          0,
          Math.min(
            this.level.width - p.w,
            rope.x + Math.sin(p.ropeAngle) * p.ropeDist - p.w / 2
          )
        );
        p.y = rope.anchorY + Math.cos(p.ropeAngle) * p.ropeDist - p.h * 0.35;

        const tangVx = Math.cos(p.ropeAngle) * p.ropeAngularVel * p.ropeDist;
        const tangVy = -Math.sin(p.ropeAngle) * p.ropeAngularVel * p.ropeDist;
        p.vx = tangVx;
        p.vy = tangVy;

        if (this.jumpPressedThisFrame) {
          p.grabbedRopeId = null;
          p.ropeCooldown = 0.36;
          p.vx = tangVx * 1.15 + (right ? 170 : left ? -170 : 0);
          p.vy = Math.min(-640, tangVy - 520);
          // Látigo / retroceso realista en los nodos al soltarse de la liana
          for (let i = 1; i < rope.nodes.length; i++) {
            rope.nodes[i].oldX += Math.sign(p.vx || p.facing) * 6;
          }
          soundEngine.playJump();
          this.spawnPopBurst(p.x + p.w / 2, p.y - 8, '¡IMPULSO!', '#7CFF00');
        } else if (downHold) {
          p.grabbedRopeId = null;
          p.ropeCooldown = 0.36;
          p.vy = Math.max(80, tangVy);
        }

        if (this.characterId === 'lautaro') {
          this.rewindSampleTimer += dt;
          if (this.rewindSampleTimer >= 0.045) {
            this.rewindSampleTimer = 0;
            this.rewindHistory.push({
              x: p.x,
              y: p.y,
              vx: p.vx,
              vy: p.vy,
              facing: p.facing,
              timestamp: this.time,
            });
            while (
              this.rewindHistory.length > 0 &&
              this.time - this.rewindHistory[0].timestamp > 1.55
            ) {
              this.rewindHistory.shift();
            }
          }
        }
        return;
      }
    }

    // Agarre automático en el aire al tocar los nodos curvos reales de una liana o cable
    if (
      !p.grabbedRopeId &&
      p.ropeCooldown <= 0 &&
      !p.onGround &&
      !isLeandroDashing &&
      !isMicaelaFloating
    ) {
      const pcx = p.x + p.w / 2;
      const handY = p.y + 18;
      for (const rope of this.ropes) {
        let bestNodeIdx = -1;
        let bestDist = 44;
        for (let i = 2; i < rope.nodes.length; i++) {
          const n = rope.nodes[i];
          const d = Math.hypot(pcx - n.x, handY - n.y);
          if (d < bestDist) {
            bestDist = d;
            bestNodeIdx = i;
          }
        }
        if (bestNodeIdx !== -1) {
          const n = rope.nodes[bestNodeIdx];
          p.grabbedRopeId = rope.id;
          const segDist = (rope.length * bestNodeIdx) / (rope.nodes.length - 1);
          p.ropeDist = Math.max(110, Math.min(rope.length, segDist));
          p.ropeAngle = Math.max(
            -0.85,
            Math.min(0.85, Math.atan2(n.x - rope.x, Math.max(60, n.y - rope.anchorY)))
          );
          p.ropeAngularVel = p.vx / Math.max(120, p.ropeDist);
          p.isCrouching = false;
          p.h = STAND_H;
          p.updraftLaunched = false;
          p.fallPeakY = p.y;
          soundEngine.playJump();
          this.spawnDust(n.x, n.y, '#FFE600');
          return;
        }
      }
    }

    if (isLeandroDashing) {
      p.vx = p.dashDir * 930;
      p.vy = 0;
      p.facing = p.dashDir;
      if (Math.random() < 0.72) {
        this.particles.push({
          x: p.x + p.w / 2,
          y: p.y + p.h / 2 + (Math.random() - 0.5) * 34,
          vx: -p.dashDir * 105,
          vy: (Math.random() - 0.5) * 42,
          size: 5.5,
          color: Math.random() < 0.5 ? '#00E5FF' : '#E2E8F0',
          life: 0.26,
          maxLife: 0.26,
          shape: 'star',
          rotation: 0,
          rotSpeed: 0,
          gravity: 0,
        });
      }
    } else {
      const moveSpeed =
        (p.isCrouching ? CROUCH_MOVE_SPEED : BASE_MOVE_SPEED) *
        spec.speedMultiplier;
      let targetVx = 0;
      if (left) {
        targetVx -= moveSpeed;
        p.facing = -1;
      }
      if (right) {
        targetVx += moveSpeed;
        p.facing = 1;
      }

      const windX = isMicaelaFloating
        ? 0
        : this.getWindAt(p.x + p.w / 2, p.y + p.h / 2);
      const crouchResist = p.isCrouching ? 0.28 : 1.0;

      if (windX !== 0 && targetVx !== 0) {
        if (Math.sign(targetVx) === Math.sign(windX)) {
          targetVx += Math.sign(windX) * Math.min(90, Math.abs(windX) * 0.2);
        } else {
          targetVx +=
            Math.sign(windX) *
            Math.min(125, Math.abs(windX) * 0.3 * crouchResist);
        }
      }

      // Hielo resbaladizo reduce notablemente la fricción y el frenado
      const onIce = p.onGround && p.groundSurface === 'ice';
      const accel = p.onGround ? (onIce ? 2.6 : 18) : 11;
      p.vx += (targetVx - p.vx) * Math.min(1, dt * accel);
      if (!onIce && Math.abs(p.vx) < 6 && targetVx === 0 && Math.abs(windX) < 110) {
        p.vx = 0;
      }

      if (
        onIce &&
        Math.abs(p.vx) > 95 &&
        (targetVx === 0 || Math.sign(targetVx) !== Math.sign(p.vx)) &&
        Math.random() < 0.35
      ) {
        this.particles.push({
          x: p.x + p.w / 2,
          y: p.y + p.h - 2,
          vx: -p.vx * 0.25 + (Math.random() - 0.5) * 30,
          vy: -24 - Math.random() * 24,
          size: 4.5,
          color: '#A5F3FC',
          life: 0.25,
          maxLife: 0.25,
          shape: 'circle',
          rotation: 0,
          rotSpeed: 0,
          gravity: 160,
        });
      }

      // Empuje real del viento en zonas ventosas y climas con viento (agacharse reduce el empuje)
      if (windX !== 0) {
        if (!p.onGround) {
          p.vx += windX * 1.15 * crouchResist * dt;
        } else if (targetVx === 0 && Math.abs(windX) > 110) {
          p.vx += windX * 0.44 * crouchResist * dt;
        }
        p.vx = Math.max(-590, Math.min(590, p.vx));
      }

      if (p.onGround) {
        p.coyoteTimer = 0.11;
      } else {
        p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
      }

      if (this.jumpPressedThisFrame) {
        p.jumpBufferTimer = 0.13;
      } else {
        p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);
      }

      if (isMicaelaFloating) {
        let targetVy = -38;
        if (upHold) targetVy = -245;
        else if (downHold) targetVy = 200;
        p.vy += (targetVy - p.vy) * Math.min(1, dt * 8);
        p.jumpBufferTimer = 0;
      } else {
        if (p.jumpBufferTimer > 0 && p.coyoteTimer > 0 && !p.isCrouching) {
          p.vy = BASE_JUMP_VELOCITY * spec.jumpMultiplier;
          p.onGround = false;
          p.coyoteTimer = 0;
          p.jumpBufferTimer = 0;
          soundEngine.playJump();
          this.spawnDust(p.x + p.w / 2, p.y + p.h, '#FFE600');
        }
        p.vy = Math.min(MAX_FALL_SPEED, p.vy + GRAVITY * dt);
      }
    }

    p.x += p.vx * dt;
    p.x = Math.max(0, Math.min(this.level.width - p.w, p.x));

    const solidObstacles = this.getSolidColliders(true);
    for (const box of solidObstacles) {
      if (this.rectsOverlap(p.x, p.y, p.w, p.h, box.x, box.y, box.w, box.h)) {
        if (
          isLeandroDashing &&
          box.platformRef &&
          box.platformRef.kind === 'breakable'
        ) {
          box.platformRef.broken = true;
          this.score += 120;
          this.shakeIntensity = 8;
          this.shaderImpact = Math.max(this.shaderImpact, 0.75);
          soundEngine.playEnemyPop();
          this.spawnPopBurst(
            box.x + box.w / 2,
            box.y + box.h / 2,
            '¡CORTE!',
            '#00E5FF'
          );
          this.spawnExplosionParticles(
            box.x + box.w / 2,
            box.y + box.h / 2,
            '#FF6B00',
            14
          );
          continue;
        }

        if (p.vx > 0) {
          p.x = box.x - p.w;
          p.vx = 0;
        } else if (p.vx < 0) {
          p.x = box.x + box.w;
          p.vx = 0;
        }
      }
    }

    const prevBottom = p.y + p.h;
    p.onGround = false;
    p.y += p.vy * dt;

    if (p.updraftLaunched) {
      p.fallPeakY = Math.min(p.fallPeakY, p.y);
    }

    for (const box of this.getSolidColliders(false)) {
      if (box.oneWay && p.dropThroughTimer > 0) continue;

      if (this.rectsOverlap(p.x, p.y, p.w, p.h, box.x, box.y, box.w, box.h)) {
        if (p.vy >= 0 && (!box.oneWay || prevBottom <= box.y + 12)) {
          p.y = box.y - p.h;
          if (box.platformRef && box.platformRef.kind === 'bounce') {
            p.vy = BOUNCE_VELOCITY;
            p.onGround = false;
            p.updraftLaunched = false;
            p.fallPeakY = p.y;
            box.platformRef.bounceCompression = 1;
            soundEngine.playBounce();
            this.spawnPopBurst(
              box.x + box.w / 2,
              box.y - 16,
              '¡BOING!',
              '#FF2D87'
            );
          } else {
            const wasUpdraftLaunched = p.updraftLaunched;
            const fallDist = p.y - p.fallPeakY;
            p.updraftLaunched = false;
            p.fallPeakY = p.y;
            p.vy = 0;
            p.onGround = true;
            p.groundSurface = box.platformRef?.surface ?? 'asphalt';
            if (box.platformRef && box.platformRef.kind === 'moving') {
              p.y += box.platformRef.dy;
            } else if (
              box.platformRef &&
              (box.platformRef.kind === 'ground' ||
                box.platformRef.kind === 'floating')
            ) {
              if (p.x > box.x + 14 && p.x + p.w < box.x + box.w - 14) {
                p.lastSafeX = p.x;
                p.lastSafeY = box.y - STAND_H - 6;
              }
            }

            if (
              wasUpdraftLaunched &&
              fallDist >= 365 &&
              box.y >= 520 &&
              !isMicaelaFloating &&
              !isLeandroDashing &&
              p.invulnTimer <= 0
            ) {
              this.hurtPlayer(p.x + p.w / 2, '¡DAÑO POR CAÍDA!');
            } else if (wasUpdraftLaunched && fallDist >= 210 && box.y < 520) {
              this.spawnDust(p.x + p.w / 2, p.y + p.h, '#BAE6FD');
            }
          }
        } else if (p.vy < 0 && !box.oneWay) {
          p.y = box.y + box.h;
          p.vy = 0;
        }
      }
    }

    // Ciclo de caminata y escenas IDLE únicas de los 6 personajes (~2s sin controles)
    if (p.onGround && Math.abs(p.vx) > 20) {
      p.walkCycle += dt * (Math.abs(p.vx) / 260);
      p.idleTime = 0;
      p.isSleepingInBed = false;
      p.isIdleScene = false;
    } else if (
      p.onGround &&
      !anyWakeInput &&
      !p.isCrouching &&
      p.powerTimer <= 0 &&
      Math.abs(p.vx) < 15
    ) {
      p.idleTime += dt;
      if (p.idleTime >= 2.0 && !p.isIdleScene) {
        p.isIdleScene = true;
        p.isSleepingInBed = this.characterId === 'micaela';
        const others = ALL_CHARACTER_IDS.filter((c) => c !== this.characterId);
        p.idleClientChar =
          others[Math.floor(Math.random() * others.length)] ?? 'gustavo';

        const idleLabels: Record<CharacterId, { text: string; color: string }> = {
          rodolfo: { text: '¡MIMOS A FELIPE!', color: '#2563EB' },
          marcela: { text: '¡PIZARRÓN!', color: '#34D399' },
          micaela: { text: '¡SIESTA!', color: '#A87BFF' },
          lautaro: { text: '¡MECÁNICA!', color: '#00B4FF' },
          leandro: { text: '¡BARBERÍA!', color: '#00C9A7' },
          gustavo: { text: '¡RECITAL!', color: '#FFE600' },
        };
        const badge = idleLabels[this.characterId];
        this.spawnPopBurst(p.x + p.w / 2, p.y - 24, badge.text, badge.color);
      }
    } else {
      p.idleTime = 0;
      p.isSleepingInBed = false;
      p.isIdleScene = false;
    }

    // Historial 1.5s para Lautaro
    if (this.characterId === 'lautaro') {
      this.rewindSampleTimer += dt;
      if (this.rewindSampleTimer >= 0.045) {
        this.rewindSampleTimer = 0;
        this.rewindHistory.push({
          x: p.x,
          y: p.y,
          vx: p.vx,
          vy: p.vy,
          facing: p.facing,
          timestamp: this.time,
        });
        while (
          this.rewindHistory.length > 0 &&
          this.time - this.rewindHistory[0].timestamp > 1.55
        ) {
          this.rewindHistory.shift();
        }
      }
    }

    if (p.y > this.level.height + 100) {
      this.handlePitFall();
    }
  }

  private updateRopes(dt: number): void {
    const p = this.player;
    const clampedDt = Math.min(dt, 0.032);
    const windBase =
      this.level.palette.season === 'autumn'
        ? 45
        : this.level.palette.season === 'winter'
          ? 35
          : 16;

    for (const rope of this.ropes) {
      const nodes = rope.nodes;
      if (nodes.length < 2) continue;
      const segLen = rope.length / (nodes.length - 1);
      const isGrabbed = p.grabbedRopeId === rope.id;
      const grabNodeIdx = isGrabbed
        ? Math.max(
            2,
            Math.min(
              nodes.length - 1,
              Math.round((p.ropeDist / rope.length) * (nodes.length - 1))
            )
          )
        : -1;

      // Integración Verlet con gravedad, brisa ambiental y zonas de viento
      for (let i = 1; i < nodes.length; i++) {
        const n = nodes[i];
        const vx = (n.x - n.oldX) * 0.985;
        const vy = (n.y - n.oldY) * 0.985;
        n.oldX = n.x;
        n.oldY = n.y;

        let windForce =
          (this.level.ambientWindX ?? 0) * 0.7 +
          Math.sin(this.time * 2.1 + rope.x * 0.01 + i * 0.35) * windBase;
        for (const wz of this.windZones) {
          if (
            n.x >= wz.x &&
            n.x <= wz.x + wz.w &&
            n.y >= wz.y &&
            n.y <= wz.y + wz.h
          ) {
            windForce += wz.forceX * 0.55;
          }
        }

        n.x += vx + windForce * clampedDt * clampedDt;
        n.y += vy + 1580 * clampedDt * clampedDt;
      }

      const handX = p.x + p.w / 2;
      const handY = p.y + p.h * 0.35;

      // Resolver restricciones de longitud para curvatura real
      for (let iter = 0; iter < 7; iter++) {
        nodes[0].x = rope.x;
        nodes[0].y = rope.anchorY;

        if (isGrabbed && grabNodeIdx > 0) {
          nodes[grabNodeIdx].x = handX;
          nodes[grabNodeIdx].y = handY;
        }

        for (let i = 0; i < nodes.length - 1; i++) {
          const a = nodes[i];
          const b = nodes[i + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          const diff = (segLen - dist) / dist;

          const aFixed = i === 0 || (isGrabbed && i === grabNodeIdx);
          const bFixed = isGrabbed && i + 1 === grabNodeIdx;

          if (aFixed && bFixed) continue;
          if (aFixed) {
            b.x += dx * diff;
            b.y += dy * diff;
          } else if (bFixed) {
            a.x -= dx * diff;
            a.y -= dy * diff;
          } else {
            a.x -= dx * diff * 0.5;
            a.y -= dy * diff * 0.5;
            b.x += dx * diff * 0.5;
            b.y += dy * diff * 0.5;
          }
        }
      }
    }
  }

  private getSolidColliders(horizontalPass: boolean): Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    oneWay: boolean;
    platformRef?: Platform;
  }> {
    const boxes: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      oneWay: boolean;
      platformRef?: Platform;
    }> = [];

    for (const plat of this.platforms) {
      if (plat.broken) continue;
      if (horizontalPass && plat.oneWay) continue;
      boxes.push({
        x: plat.x,
        y: plat.y,
        w: plat.w,
        h: plat.h,
        oneWay: !!plat.oneWay,
        platformRef: plat,
      });
    }

    for (const ch of this.chalks) {
      if (ch.kind === 'bridge') {
        if (!horizontalPass) {
          boxes.push({
            x: ch.x,
            y: ch.y,
            w: ch.w,
            h: ch.h,
            oneWay: true,
          });
        }
      } else {
        boxes.push({
          x: ch.x,
          y: ch.y,
          w: ch.w,
          h: ch.h,
          oneWay: false,
        });
      }
    }

    return boxes;
  }

  private tryActivatePower(): void {
    const p = this.player;
    const spec = CHARACTERS[this.characterId];

    if (p.powerCooldown > 0) {
      soundEngine.playNoFluid();
      this.setPowerFeedback('¡Poder recargándose!');
      return;
    }

    if (p.fluid < spec.fluidCost) {
      soundEngine.playNoFluid();
      this.setPowerFeedback('¡Falta Líquido de Freno!');
      this.spawnPopBurst(p.x + p.w / 2, p.y - 20, 'SIN LÍQUIDO', '#FF4500');
      return;
    }

    if (this.characterId === 'lautaro') {
      if (this.rewindHistory.length < 6) {
        soundEngine.playNoFluid();
        this.setPowerFeedback('Espera 1s para marcar posición');
        return;
      }
      p.fluid -= spec.fluidCost;
      p.powerCooldown = spec.cooldown;
      p.powerMaxCooldown = spec.cooldown;
      p.carRewindPath = [...this.rewindHistory].reverse();
      p.carRewindDuration = 0.52;
      p.carRewindTimer = 0.52;
      p.updraftLaunched = false;
      p.fallPeakY = p.y;
      p.invulnTimer = 1.2;
      this.shakeIntensity = 8;
      this.shaderImpact = 0.8;
      soundEngine.playPower('lautaro');
      this.spawnExplosionParticles(
        p.x + p.w / 2,
        p.y + p.h / 2,
        '#00D4FF',
        14
      );
      this.spawnPopBurst(p.x + p.w / 2, p.y - 26, 'RENAULT 19!', '#00D4FF');
      this.setPowerFeedback('¡Rebobinado Tardío (-1.5s)!');
      this.emitHud();
      return;
    }

    p.fluid -= spec.fluidCost;
    p.powerTimer = spec.powerDuration;
    p.powerCooldown = spec.cooldown + spec.powerDuration;
    p.powerMaxCooldown = p.powerCooldown;
    this.shaderImpact = Math.max(this.shaderImpact, 0.55);
    soundEngine.playPower(this.characterId);

    switch (this.characterId) {
      case 'rodolfo': {
        this.dog = {
          active: true,
          x: p.x + p.facing * 52,
          y: p.y + p.h,
          vx: 0,
          facing: p.facing,
          timer: spec.powerDuration,
          maxTimer: spec.powerDuration,
          attackCooldown: 0,
          lungeTimer: 0,
          animTime: 0,
        };
        this.spawnExplosionParticles(
          p.x + p.w / 2,
          p.y + p.h / 2,
          '#FFFFFF',
          10
        );
        this.spawnPopBurst(p.x + p.w / 2, p.y - 22, '¡FELIPE!', '#2563EB');
        this.setPowerFeedback('¡Felipe patrullando!');
        break;
      }

      case 'marcela': {
        const checkX = p.x + (p.facing > 0 ? p.w + 68 : -68);
        const footY = p.y + p.h;
        const hasGroundAhead = this.platforms.some(
          (plat) =>
            !plat.broken &&
            plat.kind !== 'breakable' &&
            checkX >= plat.x - 10 &&
            checkX <= plat.x + plat.w + 10 &&
            plat.y >= footY - 16 &&
            plat.y <= footY + 68
        );

        if (!hasGroundAhead) {
          const bridgeW = 224;
          const bridgeX = p.facing > 0 ? p.x + p.w - 6 : p.x - bridgeW + 6;
          this.chalks.push({
            id: `chalk-${this.time}`,
            kind: 'bridge',
            x: bridgeX,
            y: footY - 2,
            w: bridgeW,
            h: 20,
            timer: spec.powerDuration,
            maxTimer: spec.powerDuration,
            color: '#00E5FF',
          });
          this.spawnPopBurst(
            bridgeX + bridgeW / 2,
            footY - 30,
            '¡PUENTE!',
            '#00E5FF'
          );
          this.setPowerFeedback('¡Puente de Tiza creado!');
        } else {
          const wallX = p.facing > 0 ? p.x + p.w + 30 : p.x - 60;
          this.chalks.push({
            id: `chalk-${this.time}`,
            kind: 'wall',
            x: wallX,
            y: footY - 124,
            w: 30,
            h: 124,
            timer: spec.powerDuration,
            maxTimer: spec.powerDuration,
            color: '#FF2D87',
          });
          this.spawnPopBurst(wallX + 15, footY - 134, '¡MURALLA!', '#FF2D87');
          this.setPowerFeedback('¡Muralla de Tiza levantada!');
        }
        break;
      }

      case 'gustavo': {
        p.guitarShootTimer = 0;
        this.spawnSonicWave();
        this.spawnPopBurst(p.x + p.w / 2, p.y - 26, '¡SOLO!', '#9B2BFF');
        this.setPowerFeedback('¡Guitarra Sónica disparando!');
        break;
      }

      case 'micaela': {
        const wasLaunched = p.updraftLaunched;
        p.vy = -145;
        p.onGround = false;
        p.updraftLaunched = false;
        p.fallPeakY = p.y;
        this.spawnPopBurst(
          p.x + p.w / 2,
          p.y - 22,
          wasLaunched ? '¡AMORTIGUADO!' : '¡NUBE!',
          '#A87BFF'
        );
        this.setPowerFeedback('¡Flotando en Nube de Siesta!');
        break;
      }

      case 'leandro': {
        p.dashDir = p.facing;
        p.invulnTimer = Math.max(p.invulnTimer, spec.powerDuration + 0.2);
        this.shakeIntensity = 7.5;
        this.spawnPopBurst(p.x + p.w / 2, p.y - 22, '¡CORTE!', '#00C9A7');
        this.setPowerFeedback('¡Corte Limpio ejecutado!');
        break;
      }
    }

    this.emitHud();
  }

  private setPowerFeedback(msg: string): void {
    this.powerFeedback = msg;
    this.powerFeedbackTimer = 2.2;
  }

  private spawnSonicWave(): void {
    const p = this.player;
    soundEngine.playSonicShot();
    this.sonicWaves.push({
      id: `wave-${this.time}-${Math.random()}`,
      x: p.x + p.w / 2 + p.facing * 26,
      y: p.y + p.h * 0.45,
      vx: p.facing * 640,
      radius: 24,
      life: 0.75,
      maxLife: 0.75,
      hue: (this.time * 260) % 360,
      phase: Math.random() * Math.PI * 2,
    });
    this.particles.push({
      x: p.x + p.w / 2 + p.facing * 26,
      y: p.y + p.h * 0.35,
      vx: p.facing * 100 + (Math.random() - 0.5) * 44,
      vy: -84 - Math.random() * 52,
      size: 7,
      color: '#FFE600',
      life: 0.48,
      maxLife: 0.48,
      shape: 'note',
      rotation: 0,
      rotSpeed: 0,
      gravity: 130,
    });
  }

  private updateDog(dt: number): void {
    if (!this.dog.active) return;

    this.dog.timer -= dt;
    this.dog.animTime += dt;
    if (this.dog.attackCooldown > 0) this.dog.attackCooldown -= dt;
    if (this.dog.lungeTimer > 0) this.dog.lungeTimer -= dt;

    if (this.dog.timer <= 0) {
      this.dog.active = false;
      this.spawnExplosionParticles(
        this.player.x + this.player.w / 2,
        this.player.y + this.player.h * 0.5,
        '#FFFFFF',
        8
      );
      this.spawnPopBurst(
        this.player.x + this.player.w / 2,
        this.player.y - 22,
        '¡MOCHILA!',
        '#2563EB'
      );
      return;
    }

    const p = this.player;
    const playerCenter = p.x + p.w / 2;
    const playerBottom = p.y + p.h;

    let nearestEnemy: Enemy | null = null;
    let bestDist = 310;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const ex = e.x + e.w / 2;
      const ey = e.y + e.h;
      const d = Math.hypot(ex - playerCenter, (ey - playerBottom) * 0.7);
      if (d < bestDist) {
        bestDist = d;
        nearestEnemy = e;
      }
    }

    if (nearestEnemy && this.dog.attackCooldown <= 0) {
      const targetX = nearestEnemy.x + nearestEnemy.w / 2;
      const dx = targetX - this.dog.x;
      this.dog.facing = dx >= 0 ? 1 : -1;
      this.dog.x += Math.sign(dx) * Math.min(Math.abs(dx), 580 * dt);
      this.dog.y +=
        (nearestEnemy.y + nearestEnemy.h - this.dog.y) * Math.min(1, dt * 10);
      this.dog.lungeTimer = 0.16;

      if (Math.abs(dx) < 44) {
        this.defeatEnemy(nearestEnemy, '¡GUAU!', '#FFFFFF');
        this.dog.attackCooldown = 0.25;
      }
    } else if (
      this.boss &&
      this.boss.active &&
      this.dog.attackCooldown <= 0 &&
      Math.hypot(this.boss.x + this.boss.w / 2 - playerCenter, 0) < 420
    ) {
      const targetX = this.boss.x + this.boss.w / 2;
      const dx = targetX - this.dog.x;
      this.dog.facing = dx >= 0 ? 1 : -1;
      this.dog.x += Math.sign(dx) * Math.min(Math.abs(dx), 580 * dt);
      this.dog.y += (this.boss.y + this.boss.h - this.dog.y) * Math.min(1, dt * 10);
      if (Math.abs(dx) < 58 && this.boss.invulnTimer <= 0) {
        this.damageBoss(1, '¡MORDISCO!');
        this.dog.attackCooldown = 0.7;
      }
    } else {
      const anchorX = playerCenter - p.facing * 58;
      const dx = anchorX - this.dog.x;
      if (Math.abs(dx) > 8) {
        this.dog.facing = dx >= 0 ? 1 : -1;
        this.dog.x += dx * Math.min(1, dt * 9);
      } else {
        this.dog.facing = p.facing;
      }
      this.dog.y += (playerBottom - this.dog.y) * Math.min(1, dt * 12);
    }
  }

  private updateSonicWaves(dt: number): void {
    for (const w of this.sonicWaves) {
      w.x += w.vx * dt;
      w.life -= dt;
      w.radius += dt * 42;
      w.hue = (w.hue + dt * 360) % 360;
      w.phase += dt * 16;

      for (const e of this.enemies) {
        if (!e.alive) continue;
        const ex = e.x + e.w / 2;
        const ey = e.y + e.h / 2;
        if (Math.hypot(ex - w.x, ey - w.y) < w.radius + 32) {
          this.defeatEnemy(e, '¡RIFF!', '#00F5D4');
        }
      }

      if (this.boss && this.boss.active && this.boss.invulnTimer <= 0) {
        const bx = this.boss.x + this.boss.w / 2;
        const by = this.boss.y + this.boss.h / 2;
        if (Math.hypot(bx - w.x, by - w.y) < w.radius + 46) {
          w.life = 0;
          this.damageBoss(1, '¡RIFF!');
        }
      }
    }
    this.sonicWaves = this.sonicWaves.filter((w) => w.life > 0);
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    const pcx = p.x + p.w / 2;
    const pcy = p.y + p.h / 2;
    const isLeandroDashing =
      this.characterId === 'leandro' && p.powerTimer > 0;

    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.animTime += dt;
      if (e.attackCooldown > 0) {
        e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      }

      const ecx = e.x + e.w / 2;
      const ecy = e.y + e.h / 2;
      const distX = Math.abs(pcx - ecx);
      const distY = Math.abs(pcy - ecy);

      if (e.aiState === 'patrol') {
        if (e.type === 'drunk') {
          e.x += e.vx * (0.76 + Math.sin(e.animTime * 4.5) * 0.42) * dt;
        } else {
          e.x += e.vx * dt;
        }

        if (e.x <= e.patrolMinX) {
          e.x = e.patrolMinX;
          e.vx = Math.abs(e.vx);
        } else if (e.x + e.w >= e.patrolMaxX) {
          e.x = e.patrolMaxX - e.w;
          e.vx = -Math.abs(e.vx);
        }
        e.facing = e.vx >= 0 ? 1 : -1;

        if (
          e.attackCooldown <= 0 &&
          distX < 315 &&
          distY < 160 &&
          p.carRewindTimer <= 0
        ) {
          e.facing = pcx >= ecx ? 1 : -1;
          e.aiState = 'telegraph';
          e.aiTimer =
            e.type === 'cone'
              ? 0.42
              : e.type === 'tire'
                ? 0.46
                : e.type === 'caliper'
                  ? 0.42
                  : 0.48;
        }
      } else if (e.aiState === 'telegraph') {
        e.facing = pcx >= ecx ? 1 : -1;
        e.aiTimer -= dt;

        if (e.type === 'tire' && Math.random() < 0.55) {
          this.particles.push({
            x: ecx - e.facing * 14,
            y: e.y + e.h - 4,
            vx: -e.facing * (45 + Math.random() * 45),
            vy: -25 - Math.random() * 35,
            size: 6,
            color: '#64748B',
            life: 0.28,
            maxLife: 0.28,
            shape: 'circle',
            rotation: 0,
            rotSpeed: 0,
            gravity: -20,
          });
        }

        if (e.aiTimer <= 0) {
          e.aiState = 'attack';
          if (e.type === 'drunk') {
            this.enemyProjectiles.push({
              id: `eproj-${this.time}-${Math.random()}`,
              x: ecx + e.facing * 18,
              y: e.y + 18,
              vx: e.facing * Math.max(195, Math.min(315, distX * 1.15)),
              vy: -430,
              r: 10,
              kind: 'booze',
              rot: 0,
              life: 2.1,
            });
            e.aiTimer = 0.25;
          } else if (e.type === 'cone') {
            this.enemyProjectiles.push({
              id: `eproj-${this.time}-${Math.random()}`,
              x: ecx + e.facing * 20,
              y: e.y + 4,
              vx: e.facing * 435,
              vy: -24,
              r: 9,
              kind: 'minicone',
              rot: 0,
              life: 1.7,
            });
            e.aiTimer = 0.25;
          } else if (e.type === 'tire') {
            e.vx = e.facing * 425;
            e.aiTimer = 0.62;
          } else if (e.type === 'caliper') {
            e.vx = e.facing * 355;
            e.aiTimer = 0.48;
            this.particles.push({
              x: ecx + e.facing * 20,
              y: ecy,
              vx: 0,
              vy: 0,
              size: 28,
              color: '#F59E0B',
              life: 0.24,
              maxLife: 0.24,
              shape: 'ring',
              rotation: 0,
              rotSpeed: 0,
              gravity: 0,
            });
          } else {
            // oil_drum: dispara 2 gotas en arco de aceite ardiente
            this.enemyProjectiles.push(
              {
                id: `eproj-${this.time}-a-${Math.random()}`,
                x: ecx + e.facing * 12,
                y: e.y + 8,
                vx: e.facing * 215,
                vy: -475,
                r: 10,
                kind: 'oil',
                rot: 0,
                life: 2.2,
              },
              {
                id: `eproj-${this.time}-b-${Math.random()}`,
                x: ecx + e.facing * 14,
                y: e.y + 8,
                vx: e.facing * 320,
                vy: -545,
                r: 10,
                kind: 'oil',
                rot: 0,
                life: 2.2,
              }
            );
            e.aiTimer = 0.28;
          }
        }
      } else if (e.aiState === 'attack') {
        e.aiTimer -= dt;
        if (e.type === 'tire' || e.type === 'caliper') {
          e.x += e.vx * dt;
          if (e.x <= e.patrolMinX) {
            e.x = e.patrolMinX;
            e.aiTimer = 0;
          } else if (e.x + e.w >= e.patrolMaxX) {
            e.x = e.patrolMaxX - e.w;
            e.aiTimer = 0;
          }
          if (Math.random() < 0.6) {
            this.particles.push({
              x: ecx - e.facing * 16,
              y: e.y + e.h - 6,
              vx: -e.facing * (70 + Math.random() * 60),
              vy: -30 - Math.random() * 45,
              size: 5,
              color: e.type === 'tire' ? '#F97316' : '#FACC15',
              life: 0.25,
              maxLife: 0.25,
              shape: 'circle',
              rotation: 0,
              rotSpeed: 0,
              gravity: 120,
            });
          }
        }
        if (e.aiTimer <= 0) {
          e.aiState = 'cooldown';
          e.aiTimer = 0.45;
          e.attackCooldown =
            e.type === 'cone'
              ? 1.55
              : e.type === 'tire'
                ? 1.65
                : e.type === 'caliper'
                  ? 1.55
                  : 1.75;
          e.vx = e.facing * e.baseVx;
        }
      } else if (e.aiState === 'cooldown') {
        e.aiTimer -= dt;
        e.x += e.vx * 0.42 * dt;
        if (e.x <= e.patrolMinX) {
          e.x = e.patrolMinX;
          e.vx = Math.abs(e.vx);
        } else if (e.x + e.w >= e.patrolMaxX) {
          e.x = e.patrolMaxX - e.w;
          e.vx = -Math.abs(e.vx);
        }
        e.facing = e.vx >= 0 ? 1 : -1;
        if (e.aiTimer <= 0) {
          e.aiState = 'patrol';
        }
      }

      for (const ch of this.chalks) {
        if (ch.kind !== 'wall') continue;
        if (this.rectsOverlap(e.x, e.y, e.w, e.h, ch.x, ch.y, ch.w, ch.h)) {
          if (e.vx > 0) {
            e.x = ch.x - e.w - 1;
            e.vx = -Math.abs(e.vx);
          } else {
            e.x = ch.x + ch.w + 1;
            e.vx = Math.abs(e.vx);
          }
          e.facing = e.vx >= 0 ? 1 : -1;
        }
      }

      if (
        p.carRewindTimer <= 0 &&
        this.rectsOverlap(p.x + 5, p.y + 5, p.w - 10, p.h - 5, e.x, e.y, e.w, e.h)
      ) {
        if (isLeandroDashing) {
          this.defeatEnemy(e, '¡ZAS!', '#00C9A7');
          continue;
        }

        const playerBottomPrev = p.y + p.h - p.vy * dt;
        if (p.vy > 50 && playerBottomPrev <= e.y + 24) {
          this.defeatEnemy(e, '¡PUM!', '#FFE600');
          p.vy = -600;
          continue;
        }

        if (p.invulnTimer <= 0) {
          this.hurtPlayer(e.x + e.w / 2);
        }
      }
    }
  }

  private updateEnemyProjectiles(dt: number): void {
    const p = this.player;
    const isLeandroDashing =
      this.characterId === 'leandro' && p.powerTimer > 0;

    for (const proj of this.enemyProjectiles) {
      const windX = this.getWindAt(proj.x, proj.y);
      proj.vx += windX * 0.65 * dt;
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      const grav = proj.kind === 'minicone' ? 75 : 960;
      proj.vy += grav * dt;
      proj.rot += dt * (proj.kind === 'minicone' ? 14 : 7);
      proj.life -= dt;

      // Bloqueado por muralla de tiza de Marcela
      let blocked = false;
      for (const ch of this.chalks) {
        if (ch.kind !== 'wall') continue;
        if (
          this.rectsOverlap(
            proj.x - proj.r,
            proj.y - proj.r,
            proj.r * 2,
            proj.r * 2,
            ch.x,
            ch.y,
            ch.w,
            ch.h
          )
        ) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        proj.life = 0;
        this.spawnExplosionParticles(proj.x, proj.y, '#FF2D87', 6);
        continue;
      }

      // Salpicadura al tocar el suelo
      if (proj.y >= 596) {
        proj.life = 0;
        const splashColor =
          proj.kind === 'booze'
            ? '#4ADE80'
            : proj.kind === 'oil'
              ? '#F97316'
              : '#FB923C';
        this.spawnExplosionParticles(proj.x, 594, splashColor, 6);
        continue;
      }

      if (
        p.carRewindTimer <= 0 &&
        !isLeandroDashing &&
        p.invulnTimer <= 0 &&
        this.rectsOverlap(
          p.x + 6,
          p.y + 6,
          p.w - 12,
          p.h - 10,
          proj.x - proj.r,
          proj.y - proj.r,
          proj.r * 2,
          proj.r * 2
        )
      ) {
        proj.life = 0;
        this.hurtPlayer(proj.x);
      }
    }

    this.enemyProjectiles = this.enemyProjectiles.filter((pr) => pr.life > 0);
  }

  private updateBoss(dt: number): void {
    const boss = this.boss;
    if (!boss || !boss.active) return;

    boss.animTime += dt;
    if (boss.invulnTimer > 0) boss.invulnTimer = Math.max(0, boss.invulnTimer - dt);

    // Nubecitas de diálogo del Cliente Molesto
    if (boss.speechTimer > 0) {
      boss.speechTimer = Math.max(0, boss.speechTimer - dt);
      if (boss.speechTimer <= 0) {
        boss.speechText = null;
      }
    }
    if (boss.isFinalBoss && boss.state !== 'transform') {
      boss.speechCooldown -= dt;
      if (boss.speechCooldown <= 0) {
        const phrases =
          boss.phase === 1
            ? [
                '¡Apurate que tengo turno!',
                '¿Tanto vas a tardar?',
                '¡No me hiciste descuento!',
                '¡Me dejaste esperando!',
              ]
            : [
                'me hace un ruidito el auto',
                'necesito revisar una sola rueda',
                'no tengo plata',
                'vengo a las 9 el sábado',
                '¡es una pavada, hacelo ya!',
              ];
        boss.speechText =
          phrases[Math.floor(Math.random() * phrases.length)] ?? phrases[0];
        boss.speechTimer = 2.6;
        boss.speechCooldown = 3.4;
      }
    }

    // Reponer botellitas de líquido en la arena del jefe si se agotaron
    const anyBottleLeft = this.bottles.some((b) => !b.collected);
    if (!anyBottleLeft && this.player.fluid < 45) {
      this.bossBottleRespawnTimer += dt;
      if (this.bossBottleRespawnTimer >= 4.5) {
        this.bossBottleRespawnTimer = 0;
        for (const b of this.bottles) {
          b.collected = false;
        }
        this.spawnPopBurst(640, 310, '+LÍQUIDO!', '#FACC15');
      }
    }

    const p = this.player;
    const pcx = p.x + p.w / 2;
    const bcx = boss.x + boss.w / 2;
    boss.stateTimer -= dt;

    if (boss.state === 'transform') {
      boss.transformTimer -= dt;
      boss.vx = 0;
      boss.headFireActive = true;
      if (Math.random() < 0.7) {
        this.particles.push({
          x: bcx + (Math.random() - 0.5) * 90,
          y: boss.y + boss.h * Math.random(),
          vx: (Math.random() - 0.5) * 200,
          vy: -120 - Math.random() * 140,
          size: 7,
          color: Math.random() < 0.5 ? '#FFE600' : '#EF4444',
          life: 0.35,
          maxLife: 0.35,
          shape: 'star',
          rotation: 0,
          rotSpeed: 0,
          gravity: 120,
        });
      }
      if (boss.transformTimer <= 0) {
        boss.state = 'idle';
        boss.stateTimer = 0.65;
        boss.headFireActive = true;
        this.spawnExplosionParticles(bcx, boss.y + boss.h / 2, '#FF2D87', 18);
      }
    } else if (boss.state === 'idle') {
      boss.facing = pcx >= bcx ? 1 : -1;
      boss.vx *= Math.pow(0.05, dt);
      boss.headFireActive = true;
      if (boss.stateTimer <= 0) {
        boss.state = 'telegraph';
        boss.stateTimer = boss.isFinalBoss ? (boss.phase === 2 ? 0.5 : 0.58) : 0.65;
        boss.attackPattern = (boss.attackPattern + 1) % 3;
      }
    } else if (boss.state === 'telegraph') {
      boss.facing = pcx >= bcx ? 1 : -1;
      boss.vx = 0;
      boss.headFireActive = true;
      if (boss.stateTimer <= 0) {
        boss.state = 'attack';
        if (boss.attackPattern === 0) {
          const speed = boss.isFinalBoss
            ? boss.phase === 2
              ? 560
              : 430
            : boss.id === 'demon_tire'
              ? 460
              : 390;
          boss.vx = boss.facing * speed;
          boss.stateTimer =
            boss.id === 'demon_tire'
              ? 1.15
              : boss.isFinalBoss && boss.phase === 2
                ? 1.05
                : 0.95;
        } else if (boss.attackPattern === 1) {
          boss.vy =
            boss.id === 'caliper_titan'
              ? -720
              : boss.isFinalBoss && boss.phase === 2
                ? -600
                : -660;
          boss.vx = boss.facing * (boss.isFinalBoss && boss.phase === 2 ? 320 : 240);
          boss.stateTimer = 1.05;
        } else {
          this.fireBossProjectiles();
          boss.stateTimer = 0.65;
        }
      }
    } else if (boss.state === 'attack') {
      if (boss.isFinalBoss && boss.phase === 2 && Math.random() < 0.55) {
        this.particles.push({
          x: boss.x + (boss.facing > 0 ? 12 : boss.w - 12),
          y: boss.y + boss.h - 14,
          vx: -boss.facing * (70 + Math.random() * 60),
          vy: -25 - Math.random() * 35,
          size: 7,
          color: '#CBD5E1',
          life: 0.3,
          maxLife: 0.3,
          shape: 'circle',
          rotation: 0,
          rotSpeed: 0,
          gravity: -20,
        });
      }
      if (boss.stateTimer <= 0) {
        boss.state = 'recover';
        boss.stateTimer = boss.id === 'cone_king' ? 2.6 : 2.35;
        boss.vx = 0;
        boss.headFireActive = false;
        const recoverText =
          boss.id === 'cone_king'
            ? '¡ENFRIADO · SALTA!'
            : boss.id === 'demon_tire'
              ? '¡MAREADA · SALTA!'
              : boss.id === 'bottle_brute'
                ? '¡DESTAPADO · SALTA!'
                : boss.id === 'caliper_titan'
                  ? '¡ATASCADA · SALTA!'
                  : boss.phase === 1
                    ? '¡SIN ALIENTO · SALTA!'
                    : '¡MOTOR RECALENTADO!';
        this.spawnPopBurst(bcx, boss.y - 26, recoverText, '#4ADE80');
      }
    } else if (boss.state === 'recover' || boss.state === 'hurt') {
      boss.vx *= Math.pow(0.02, dt);
      boss.headFireActive = false;
      if (boss.stateTimer <= 0) {
        boss.state = 'idle';
        boss.stateTimer = boss.isFinalBoss ? 0.62 : 0.8;
        boss.headFireActive = true;
      }
    }

    boss.vy += GRAVITY * dt;
    boss.x += boss.vx * dt;
    boss.y += boss.vy * dt;

    if (boss.y + boss.h >= 600) {
      boss.y = 600 - boss.h;
      boss.vy = 0;
    }
    if (boss.x < 40) {
      boss.x = 40;
      if (
        (boss.id === 'demon_tire' || (boss.isFinalBoss && boss.phase === 2)) &&
        boss.state === 'attack'
      ) {
        boss.vx = 80;
        boss.state = 'recover';
        boss.stateTimer = 2.45;
        boss.headFireActive = false;
        this.shakeIntensity = 8;
        this.spawnPopBurst(
          bcx,
          boss.y - 24,
          boss.isFinalBoss ? '¡MOTOR RECALENTADO!' : '¡CHOQUE · MAREADA!',
          '#4ADE80'
        );
      } else {
        boss.vx = Math.abs(boss.vx);
      }
    } else if (boss.x + boss.w > this.level.width - 40) {
      boss.x = this.level.width - 40 - boss.w;
      if (
        (boss.id === 'demon_tire' || (boss.isFinalBoss && boss.phase === 2)) &&
        boss.state === 'attack'
      ) {
        boss.vx = -80;
        boss.state = 'recover';
        boss.stateTimer = 2.45;
        boss.headFireActive = false;
        this.shakeIntensity = 8;
        this.spawnPopBurst(
          bcx,
          boss.y - 24,
          boss.isFinalBoss ? '¡MOTOR RECALENTADO!' : '¡CHOQUE · MAREADA!',
          '#4ADE80'
        );
      } else {
        boss.vx = -Math.abs(boss.vx);
      }
    }

    // Muralla de tiza de Marcela frena y aturde embestidas (abre la ventana vulnerable de cualquier jefe)
    for (const ch of this.chalks) {
      if (ch.kind !== 'wall') continue;
      if (this.rectsOverlap(boss.x, boss.y, boss.w, boss.h, ch.x, ch.y, ch.w, ch.h)) {
        boss.vx = -boss.facing * 110;
        boss.state = 'recover';
        boss.stateTimer = 2.4;
        boss.headFireActive = false;
        ch.timer = Math.min(ch.timer, 0.2);
        this.spawnPopBurst(bcx, boss.y - 20, '¡BLOQUEO!', '#FF2D87');
      }
    }

    // Colisión jugador vs Jefe
    const isLeandroDashing =
      this.characterId === 'leandro' && p.powerTimer > 0;
    if (
      p.carRewindTimer <= 0 &&
      boss.state !== 'transform' &&
      this.rectsOverlap(p.x + 4, p.y + 4, p.w - 8, p.h - 4, boss.x, boss.y, boss.w, boss.h)
    ) {
      if (isLeandroDashing && boss.invulnTimer <= 0) {
        this.damageBoss(1, '¡CORTE!');
        return;
      }

      const playerBottomPrev = p.y + p.h - p.vy * dt;
      if (p.vy > 40 && playerBottomPrev <= boss.y + 34) {
        if (boss.headFireActive) {
          const warnText =
            boss.id === 'cone_king'
              ? '¡QUEMA! ESPERA'
              : boss.id === 'demon_tire'
                ? '¡PINCHES! ESPERA'
                : boss.id === 'bottle_brute'
                  ? '¡TAPA DURA! ESPERA'
                  : boss.id === 'caliper_titan'
                    ? '¡MORDAZA! ESPERA'
                    : boss.phase === 1
                      ? '¡FURIOSO! ESPERA'
                      : '¡CARROCERÍA! ESPERA';
          this.spawnPopBurst(bcx, boss.y - 24, warnText, '#FB923C');
          if (p.invulnTimer <= 0) {
            this.hurtPlayer(bcx);
          } else {
            p.vy = -520;
          }
          return;
        }
        if (boss.invulnTimer <= 0) {
          p.vy = -680;
          p.invulnTimer = Math.max(p.invulnTimer, 0.55);
          this.damageBoss(1, '¡PUM!');
          return;
        }
      }

      if (p.invulnTimer <= 0) {
        this.hurtPlayer(bcx);
      }
    }
  }

  private fireBossProjectiles(): void {
    const boss = this.boss;
    if (!boss) return;
    const cx = boss.x + boss.w / 2;
    const cy = boss.y + boss.h * 0.5;
    const kind: BossProjectile['kind'] =
      boss.id === 'cone_king'
        ? 'spark'
        : boss.id === 'demon_tire'
          ? 'spark'
          : boss.id === 'bottle_brute'
            ? 'bottle'
            : boss.id === 'caliper_titan'
              ? 'blade'
              : 'gear';

    const count = boss.isFinalBoss ? (boss.phase === 2 ? 3 : 2) : 2;
    for (let i = 0; i < count; i++) {
      const spreadY = (i - (count - 1) / 2) * 130;
      this.bossProjectiles.push({
        id: `bproj-${this.time}-${i}`,
        x: cx + boss.facing * 32,
        y: cy - 12,
        vx: boss.facing * (380 + i * 45),
        vy: spreadY - 60,
        r: 14,
        kind,
        rot: 0,
        life: 2.8,
      });
    }
  }

  private updateBossProjectiles(dt: number): void {
    const p = this.player;
    const isLeandroDashing =
      this.characterId === 'leandro' && p.powerTimer > 0;

    for (const proj of this.bossProjectiles) {
      const windX = this.getWindAt(proj.x, proj.y);
      proj.vx += windX * 0.65 * dt;
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.vy += 260 * dt;
      proj.rot += dt * 10;
      proj.life -= dt;

      if (proj.y > 590) {
        proj.y = 590;
        proj.vy = -Math.abs(proj.vy) * 0.65;
      }

      if (
        p.carRewindTimer <= 0 &&
        !isLeandroDashing &&
        p.invulnTimer <= 0 &&
        this.rectsOverlap(
          p.x + 6,
          p.y + 6,
          p.w - 12,
          p.h - 10,
          proj.x - proj.r,
          proj.y - proj.r,
          proj.r * 2,
          proj.r * 2
        )
      ) {
        proj.life = 0;
        this.hurtPlayer(proj.x);
      }
    }

    this.bossProjectiles = this.bossProjectiles.filter((pr) => pr.life > 0);
  }

  private damageBoss(dmg: number, shout: string): void {
    const boss = this.boss;
    if (!boss || !boss.active || boss.state === 'transform') return;

    boss.hp = Math.max(0, boss.hp - dmg);
    boss.invulnTimer = 0.65;
    boss.state = 'hurt';
    boss.stateTimer = 0.45;
    boss.headFireActive = false;
    this.player.celebrateTimer = 0.6;
    this.shakeIntensity = 11;
    this.shaderImpact = 1.0;
    soundEngine.playBossHit();

    const bx = boss.x + boss.w / 2;
    const by = boss.y + boss.h / 2;
    this.spawnPopBurst(bx, boss.y - 16, shout, '#FFE600');
    this.spawnExplosionParticles(bx, by, '#EF4444', 14);

    if (boss.hp <= 0) {
      if (boss.isFinalBoss && boss.phase === 1) {
        // Transformación dramática a Fase 2 dentro del auto
        boss.phase = 2;
        boss.state = 'transform';
        boss.transformTimer = 1.85;
        boss.invulnTimer = 2.0;
        boss.hp = 8;
        boss.maxHp = 8;
        boss.w = 164;
        boss.h = 110;
        boss.y = 600 - 110;
        boss.x = Math.max(40, Math.min(this.level.width - 40 - boss.w, boss.x - 40));
        boss.vx = 0;
        boss.vy = 0;
        boss.headFireActive = true;
        boss.subtitle = 'Monstruo Final · Fase 2 en Auto (¡Espera a que recaliente!)';
        boss.speechText = 'me hace un ruidito el auto';
        boss.speechTimer = 3.0;
        boss.speechCooldown = 2.4;
        this.bossProjectiles = [];
        this.shaderImpact = 1.0;
        this.shakeIntensity = 14;
        soundEngine.playBossDefeat();
        this.spawnExplosionParticles(bx, by, '#FFE600', 22);
        this.spawnPopBurst(bx, boss.y - 24, '¡FASE 2 · AL AUTO!', '#FFE600');
        this.emitHud();
        return;
      }

      boss.active = false;
      this.bossDefeated = true;
      this.bossProjectiles = [];
      this.score += 1000;
      this.enemiesDefeatedTotal += 1;

      // Recarga 100% de corazones al derrotar a cualquier jefe
      this.lives = this.maxLives;
      this.spawnPopBurst(
        this.player.x + this.player.w / 2,
        this.player.y - 34,
        '¡VIDAS AL 100%!',
        '#FF2D87'
      );
      this.spawnExplosionParticles(
        this.player.x + this.player.w / 2,
        this.player.y + this.player.h / 2,
        '#FF2D87',
        16
      );

      soundEngine.playBossDefeat();
      soundEngine.playUnlockCharacter();
      this.spawnExplosionParticles(bx, by, '#FFE600', 28);

      if (!this.unlockedCharacters.includes(boss.unlocksCharacter)) {
        this.unlockedCharacters.push(boss.unlocksCharacter);
      }
      this.newlyUnlockedCharacter = boss.unlocksCharacter;

      if (boss.isFinalBoss) {
        this.startCinematic();
      } else {
        this.swapsRemainingThisLevel = 1;
        this.returnPhaseAfterSelect = 'PLAYING';
        this.phase = 'BOSS_VICTORY';
        this.emitHud();
      }
    } else {
      this.emitHud();
    }
  }

  private checkHazards(dt: number): void {
    const p = this.player;
    if (p.carRewindTimer > 0) return;

    const isLeandroDashing =
      this.characterId === 'leandro' && p.powerTimer > 0;
    const isMicaelaFloating =
      this.characterId === 'micaela' && p.powerTimer > 0;

    for (const h of this.hazards) {
      const insetX =
        h.type === 'fire' || h.type === 'ice_column' ? 4 : h.type === 'suction' ? 6 : 0;
      const insetY = h.type === 'fire' || h.type === 'ice_column' ? 4 : 0;
      const hx = h.x + insetX;
      const hy = h.y + insetY;
      const hw = Math.max(8, h.w - insetX * 2);
      const hh = Math.max(8, h.h - insetY);

      if (
        this.rectsOverlap(
          p.x + 6,
          p.y + 6,
          p.w - 12,
          p.h - 8,
          hx,
          hy,
          hw,
          hh
        )
      ) {
        if (h.type === 'water') {
          this.spawnExplosionParticles(p.x + p.w / 2, h.y, '#00E5FF', 12);
          this.spawnPopBurst(p.x + p.w / 2, h.y - 26, '¡SPLASH!', '#00E5FF');
          this.handlePitFall();
          return;
        } else if (
          h.type === 'fire' &&
          getPulsingFirePhase(h, this.time).state === 'active' &&
          p.invulnTimer <= 0 &&
          !isLeandroDashing
        ) {
          this.hurtPlayer(h.x + h.w / 2);
          return;
        } else if (
          h.type === 'ice_column' &&
          getPulsingTrapPhase(h, this.time).state === 'active' &&
          !isLeandroDashing &&
          p.frozenTimer <= 0 &&
          p.frozenCooldown <= 0
        ) {
          p.frozenTimer = 1.85;
          p.frozenMaxTimer = 1.85;
          p.frozenShakeCount = 0;
          p.vx = 0;
          p.vy = Math.min(p.vy, 60);
          p.grabbedRopeId = null;
          p.isCrouching = false;
          p.h = STAND_H;
          p.isIdleScene = false;
          p.isSleepingInBed = false;
          p.idleTime = 0;

          // Bloquea el paso manteniendo al jugador en el borde de entrada de la columna
          const dir = h.direction ?? 'up';
          if (dir === 'up' || dir === 'down') {
            const hcx = h.x + h.w / 2;
            const pcx = p.x + p.w / 2;
            if (pcx < hcx) {
              p.x = Math.max(0, Math.min(p.x, h.x - p.w * 0.45));
            } else {
              p.x = Math.min(
                this.level.width - p.w,
                Math.max(p.x, h.x + h.w - p.w * 0.55)
              );
            }
          }

          soundEngine.playFreeze();
          this.shakeIntensity = Math.max(this.shakeIntensity, 5.5);
          this.spawnExplosionParticles(
            p.x + p.w / 2,
            p.y + p.h / 2,
            '#7DD3FC',
            12
          );
          this.spawnPopBurst(
            p.x + p.w / 2,
            p.y - 20,
            '¡CONGELADO!',
            '#38BDF8'
          );
          return;
        } else if (
          h.type === 'updraft' &&
          getPulsingTrapPhase(h, this.time).state === 'active' &&
          !isLeandroDashing &&
          p.frozenTimer <= 0
        ) {
          if (isMicaelaFloating) {
            p.vy = Math.min(p.vy, -420);
            p.updraftLaunched = false;
            p.fallPeakY = p.y;
          } else if (p.vy > -1150) {
            const wasLaunched = p.updraftLaunched;
            p.vy = -1330;
            p.onGround = false;
            p.grabbedRopeId = null;
            p.isCrouching = false;
            p.h = STAND_H;
            p.updraftLaunched = true;
            p.fallPeakY = wasLaunched ? Math.min(p.fallPeakY, p.y) : p.y;
            soundEngine.playUpdraftWhoosh();
            this.shakeIntensity = Math.max(this.shakeIntensity, 4.5);
            this.spawnExplosionParticles(
              p.x + p.w / 2,
              Math.min(595, h.y + h.h - 20),
              '#BAE6FD',
              10
            );
            this.spawnPopBurst(
              p.x + p.w / 2,
              p.y - 22,
              '¡CHORRO DE AIRE!',
              '#38BDF8'
            );
          }
        } else if (h.type === 'suction') {
          const suctionPhase = getPulsingTrapPhase(h, this.time);
          const pitCx = h.x + h.w / 2;
          const pcx = p.x + p.w / 2;
          if (suctionPhase.state === 'active' && !isLeandroDashing) {
            const wasPulled = p.vy >= 340;
            p.grabbedRopeId = null;
            p.updraftLaunched = false;
            p.vy = Math.min(MAX_FALL_SPEED, Math.max(p.vy + 4200 * dt, 380));
            p.vx += (pitCx - pcx) * 4.5 * dt;
            if (!wasPulled) {
              soundEngine.playSuctionWhoosh();
              this.spawnPopBurst(pcx, p.y - 18, '¡SUCCIÓN!', '#C084FC');
            }
          }
          if (p.y + p.h >= 662) {
            const isSuctioned = suctionPhase.state === 'active' && !isLeandroDashing;
            this.spawnExplosionParticles(
              pcx,
              620,
              isSuctioned ? '#C084FC' : '#64748B',
              12
            );
            this.spawnPopBurst(
              pcx,
              570,
              isSuctioned ? '¡SUCCIONADO!' : '¡AL POZO!',
              isSuctioned ? '#C084FC' : '#F97316'
            );
            this.handlePitFall();
            return;
          }
        }
      }
    }
  }

  private defeatEnemy(e: Enemy, shout: string, color: string): void {
    if (!e.alive) return;
    e.alive = false;
    this.enemiesDefeatedTotal += 1;
    this.score += 150;
    this.player.celebrateTimer = 0.55;
    this.shakeIntensity = Math.max(this.shakeIntensity, 8.5);
    this.shaderImpact = Math.max(this.shaderImpact, 0.55);
    soundEngine.playEnemyPop();
    this.spawnPopBurst(e.x + e.w / 2, e.y, shout, color);
    this.spawnExplosionParticles(e.x + e.w / 2, e.y + e.h / 2, color, 14);
  }

  private hurtPlayer(sourceX: number, label = '¡AY!'): void {
    const p = this.player;
    this.lives -= 1;
    this.shakeIntensity = 11;
    this.shaderImpact = 0.95;
    p.hurtAnimTimer = 0.8;
    soundEngine.playHurt();
    this.spawnPopBurst(p.x + p.w / 2, p.y - 16, label, '#FF1E56');
    this.spawnExplosionParticles(p.x + p.w / 2, p.y + p.h / 2, '#FF1E56', 10);

    if (this.lives <= 0) {
      this.lives = 0;
      this.phase = 'GAME_OVER';
      this.emitHud();
      return;
    }

    p.invulnTimer = 1.6;
    p.vy = -440;
    p.vx = p.x + p.w / 2 < sourceX ? -280 : 280;
    this.emitHud();
  }

  private handlePitFall(): void {
    this.lives -= 1;
    this.shakeIntensity = 10;
    this.shaderImpact = 0.85;
    soundEngine.playHurt();

    if (this.lives <= 0) {
      this.lives = 0;
      this.phase = 'GAME_OVER';
      this.emitHud();
      return;
    }

    const p = this.player;
    p.isCrouching = false;
    p.isIdleScene = false;
    p.isSleepingInBed = false;
    p.grabbedRopeId = null;
    p.ropeCooldown = 0.25;
    p.frozenTimer = 0;
    p.frozenCooldown = 0;
    p.frozenShakeCount = 0;
    p.updraftLaunched = false;
    p.fallPeakY = p.lastSafeY;
    p.h = STAND_H;
    p.x = p.lastSafeX;
    p.y = p.lastSafeY;
    p.vx = 0;
    p.vy = 0;
    p.powerTimer = 0;
    p.invulnTimer = 1.6;
    p.hurtAnimTimer = 0.7;
    p.fluid = Math.max(p.fluid, 40);
    this.rewindHistory = [];
    this.spawnPopBurst(p.x + p.w / 2, p.y - 22, '¡CASI!', '#FF6B00');
    this.emitHud();
  }

  private checkCollectibles(): void {
    const p = this.player;
    const pcx = p.x + p.w / 2;
    const pcy = p.y + p.h / 2;

    for (const b of this.bottles) {
      if (b.collected) continue;
      if (Math.hypot(pcx - b.x, pcy - b.y) < 40) {
        b.collected = true;
        this.bottlesCollectedTotal += 1;
        this.score += 50;
        p.fluid = Math.min(p.maxFluid, p.fluid + FLUID_PER_BOTTLE);
        soundEngine.playFluidPickup();
        this.spawnExplosionParticles(b.x, b.y, '#FF8800', 7);
        this.spawnPopBurst(b.x, b.y - 16, `+${FLUID_PER_BOTTLE}`, '#FF8800');
        this.emitHud();
      }
    }

    for (const heart of this.hearts) {
      if (heart.collected) continue;
      if (Math.hypot(pcx - heart.x, pcy - heart.y) < 42) {
        heart.collected = true;
        if (this.lives < this.maxLives) {
          this.lives += 1;
          this.spawnPopBurst(heart.x, heart.y - 20, '¡+1 VIDA!', '#FF2D87');
        } else {
          this.score += 250;
          this.spawnPopBurst(heart.x, heart.y - 20, '¡VIDA FULL +250!', '#FF2D87');
        }
        soundEngine.playPartPickup();
        this.spawnExplosionParticles(heart.x, heart.y, '#FF2D87', 12);
        this.emitHud();
      }
    }

    for (const part of this.parts) {
      if (part.collected) continue;
      if (Math.hypot(pcx - part.x, pcy - part.y) < 44) {
        part.collected = true;
        this.score += 300;
        p.celebrateTimer = 0.75;
        this.shakeIntensity = 7.5;
        this.shaderImpact = Math.max(this.shaderImpact, 0.5);
        soundEngine.playPartPickup();
        this.spawnPopBurst(part.x, part.y - 22, 'REPUESTO!', '#00E5FF');
        this.spawnExplosionParticles(part.x, part.y, '#FFE600', 14);
        this.emitHud();
      }
    }
  }

  private checkGoal(): void {
    const p = this.player;
    const pcx = p.x + p.w / 2;
    const pcy = p.y + p.h / 2;

    // Si el jefe fue derrotado y el jugador está probando un héroe en su arena,
    // cruzar el portal abierto avanza automáticamente al siguiente capítulo.
    if (this.level.isBossArena) {
      if (!this.bossDefeated) return;
      if (
        Math.abs(pcx - this.level.goalX) < 76 &&
        Math.abs(pcy - (this.level.goalY + 68)) < 116
      ) {
        this.nextLevel();
      }
      return;
    }

    const allPartsCollected = this.parts.every((pt) => pt.collected);
    if (!allPartsCollected) return;

    if (
      Math.abs(pcx - this.level.goalX) < 76 &&
      Math.abs(pcy - (this.level.goalY + 68)) < 116
    ) {
      this.score += 500;
      soundEngine.playLevelClear();
      this.phase = 'LEVEL_COMPLETE';
      this.emitHud();
    }
  }

  private updateParticles(dt: number): void {
    for (const pt of this.particles) {
      if (pt.shape !== 'ring') {
        const windX = this.getWindAt(pt.x, pt.y);
        pt.vx += windX * 1.35 * dt;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += pt.gravity * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);

    for (const pop of this.popBursts) {
      pop.life -= dt;
    }
    this.popBursts = this.popBursts.filter((pop) => pop.life > 0);
  }

  private updateCamera(dt: number): void {
    const virtualW = Math.max(
      854,
      Math.round(
        (this.displayCanvas.width / Math.max(1, this.displayCanvas.height)) *
          VIRTUAL_H
      )
    );
    const targetCamX = Math.max(
      0,
      Math.min(
        this.level.width - virtualW,
        this.player.x + this.player.w / 2 - virtualW * 0.36
      )
    );
    this.cameraX += (targetCamX - this.cameraX) * Math.min(1, dt * 8);
  }

  private spawnDust(x: number, y: number, color: string): void {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 26,
        y,
        vx: (Math.random() - 0.5) * 120,
        vy: -38 - Math.random() * 52,
        size: 5,
        color,
        life: 0.32,
        maxLife: 0.32,
        shape: 'circle',
        rotation: 0,
        rotSpeed: 0,
        gravity: 220,
      });
    }
  }

  private spawnExplosionParticles(
    x: number,
    y: number,
    color: string,
    count: number
  ): void {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 38,
      color,
      life: 0.26,
      maxLife: 0.26,
      shape: 'ring',
      rotation: 0,
      rotSpeed: 0,
      gravity: 0,
    });

    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = 110 + Math.random() * 230;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 62,
        size: 5 + Math.random() * 5,
        color: i % 2 === 0 ? color : '#FFE600',
        life: 0.42 + Math.random() * 0.22,
        maxLife: 0.64,
        shape: 'circle',
        rotation: 0,
        rotSpeed: 0,
        gravity: 480,
      });
    }
  }

  private spawnPopBurst(
    x: number,
    y: number,
    text: string,
    color: string
  ): void {
    this.popBursts.push({
      x,
      y,
      text,
      color,
      life: 0.76,
      maxLife: 0.76,
      scale: 1,
    });
  }

  private rectsOverlap(
    ax: number,
    ay: number,
    aw: number,
    ah: number,
    bx: number,
    by: number,
    bw: number,
    bh: number
  ): boolean {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  private render(): void {
    const w = Math.max(1, this.displayCanvas.width);
    const h = Math.max(1, this.displayCanvas.height);
    if (this.sceneCanvas.width !== w || this.sceneCanvas.height !== h) {
      this.sceneCanvas.width = w;
      this.sceneCanvas.height = h;
    }

    renderGameScene(this.sceneCtx, w, h, {
      level: this.level,
      time: this.time,
      cameraX: this.cameraX,
      shakeX: this.shakeX,
      shakeY: this.shakeY,
      player: this.player,
      characterId: this.characterId,
      platforms: this.platforms,
      hazards: this.hazards,
      ropes: this.ropes,
      windZones: this.windZones,
      bottles: this.bottles,
      hearts: this.hearts,
      parts: this.parts,
      enemies: this.enemies,
      enemyProjectiles: this.enemyProjectiles,
      boss: this.boss,
      bossDefeated: this.bossDefeated,
      bossProjectiles: this.bossProjectiles,
      chalks: this.chalks,
      sonicWaves: this.sonicWaves,
      dog: this.dog,
      rewindHistory: this.rewindHistory,
      particles: this.particles,
      popBursts: this.popBursts,
      allPartsCollected: this.parts.every((pt) => pt.collected),
      cinematic: this.cinematic,
    });

    const fade = this.phase === 'CINEMATIC' ? this.cinematic.fadeBlack : 0;
    this.shader.present(this.sceneCanvas, this.time, this.shaderImpact, fade);
  }

  private emitHud(): void {
    const musicMode =
      this.phase === 'CINEMATIC' ||
      this.phase === 'VICTORY' ||
      this.phase === 'BOSS_VICTORY' ||
      this.phase === 'LEVEL_COMPLETE'
        ? 'victory'
        : this.phase === 'PAUSED'
          ? 'paused'
          : this.phase === 'CHARACTER_SELECT' ||
              this.phase === 'FINAL_BOSS_SELECT' ||
              this.phase === 'GAME_OVER'
            ? 'menu'
            : this.level.isBossArena && !this.bossDefeated
              ? 'boss'
              : 'level';
    soundEngine.setMusicMode(musicMode);

    const spec = CHARACTERS[this.characterId];
    const collectedParts = this.parts.filter((pt) => pt.collected);
    this.onHudUpdate({
      phase: this.phase,
      characterId: this.characterId,
      unlockedCharacters: [...this.unlockedCharacters],
      newlyUnlockedCharacter: this.newlyUnlockedCharacter,
      levelIndex: this.levelIndex,
      totalLevels: LEVELS.length,
      levelTitle: this.level.title,
      levelSubtitle: this.level.subtitle,
      storyNote: this.level.storyNote,
      lives: this.lives,
      maxLives: this.maxLives,
      fluid: Math.round(this.player.fluid),
      maxFluid: this.player.maxFluid,
      partsCollected: collectedParts.length,
      partsTotal: this.parts.length,
      isBossArena: this.level.isBossArena,
      bossDefeated: this.bossDefeated,
      bossName: this.boss?.name ?? null,
      bossSubtitle: this.boss?.subtitle ?? null,
      bossHp: this.boss?.hp ?? 0,
      bossMaxHp: this.boss?.maxHp ?? 0,
      powerActive:
        this.player.powerTimer > 0 || this.player.carRewindTimer > 0,
      powerTimer: Math.max(
        this.player.powerTimer,
        this.player.carRewindTimer
      ),
      powerDuration: spec.powerDuration,
      powerCooldown: this.player.powerCooldown,
      powerMaxCooldown: this.player.powerMaxCooldown,
      bottlesCollected: this.bottlesCollectedTotal,
      enemiesDefeated: this.enemiesDefeatedTotal,
      score: this.score,
      muted: soundEngine.isMuted(),
      musicVolume: Math.round(soundEngine.getMusicVolume() * 100),
      powerFeedback: this.powerFeedback,
      cinematicCaption: this.cinematic.active ? this.cinematic.caption : null,
      showTheEnd: this.cinematic.active && this.cinematic.showTheEnd,
      gameCompleted: this.gameCompleted,
      swapsRemaining: this.swapsRemainingThisLevel,
      ambientWindX: this.level.ambientWindX ?? 0,
    });
  }
}
