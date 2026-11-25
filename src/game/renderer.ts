import {
  BossProjectile,
  BossState,
  BrakePart,
  BrakePartType,
  ChalkConstruct,
  CharacterExpression,
  CharacterId,
  CinematicState,
  DogCompanion,
  Enemy,
  EnemyProjectile,
  FluidBottle,
  HazardZone,
  HeartPickup,
  LevelDefinition,
  Particle,
  Platform,
  PlayerState,
  PopBurst,
  RewindSample,
  RopeState,
  SeasonType,
  SonicWave,
  WindZone,
} from './types';

export interface RenderSceneState {
  level: LevelDefinition;
  time: number;
  cameraX: number;
  shakeX: number;
  shakeY: number;
  player: PlayerState;
  characterId: CharacterId;
  platforms: Platform[];
  hazards: HazardZone[];
  ropes: RopeState[];
  windZones: WindZone[];
  bottles: FluidBottle[];
  hearts: HeartPickup[];
  parts: BrakePart[];
  enemies: Enemy[];
  enemyProjectiles: EnemyProjectile[];
  boss: BossState | null;
  bossDefeated: boolean;
  bossProjectiles: BossProjectile[];
  chalks: ChalkConstruct[];
  sonicWaves: SonicWave[];
  dog: DogCompanion;
  rewindHistory: RewindSample[];
  particles: Particle[];
  popBursts: PopBurst[];
  allPartsCollected: boolean;
  cinematic: CinematicState;
}

export function getPulsingTrapPhase(
  h: HazardZone,
  time: number
): { state: 'idle' | 'warning' | 'active'; intensity: number; progress: number } {
  if (!h.pulsing) return { state: 'active', intensity: 1, progress: 1 };
  const period = h.cyclePeriod ?? 3.2;
  const phase = (((time + (h.phaseOffset ?? 0)) % period) + period) % period;
  const t = phase / period;
  if (t < 0.45) return { state: 'idle', intensity: 0.14, progress: t / 0.45 };
  if (t < 0.64) return { state: 'warning', intensity: 0.45, progress: (t - 0.45) / 0.19 };
  if (t < 0.96) return { state: 'active', intensity: 1, progress: (t - 0.64) / 0.32 };
  return { state: 'idle', intensity: 0.25, progress: 0 };
}

export function getPulsingFirePhase(
  h: HazardZone,
  time: number
): { state: 'embers' | 'warning' | 'active'; intensity: number; progress: number } {
  const phase = getPulsingTrapPhase(h, time);
  return {
    state: phase.state === 'idle' ? 'embers' : phase.state,
    intensity: phase.intensity,
    progress: phase.progress,
  };
}

const VIRTUAL_H = 720;

export function renderGameScene(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  state: RenderSceneState
): void {
  const scale = canvasH / VIRTUAL_H;
  const viewW = canvasW / scale;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);

  if (state.cinematic.active) {
    renderCinematicScene(ctx, viewW, VIRTUAL_H, state);
    ctx.restore();
    return;
  }

  ctx.translate(state.shakeX, state.shakeY);

  // 1. Fondo atmosférico suave y ciudad en paralaje
  drawSkyAndAtmosphere(ctx, viewW, VIRTUAL_H, state);
  drawParallaxCity(ctx, viewW, VIRTUAL_H, state);

  // Neblina atmosférica que separa claramente el fondo de la capa jugable
  const fogGrad = ctx.createLinearGradient(0, 260, 0, VIRTUAL_H);
  fogGrad.addColorStop(0, 'rgba(255,255,255,0)');
  fogGrad.addColorStop(0.6, state.level.palette.horizonFog);
  fogGrad.addColorStop(1, state.level.palette.horizonFog);
  ctx.fillStyle = fogGrad;
  ctx.fillRect(-32, 260, viewW + 64, VIRTUAL_H - 260);

  // 2. Capa jugable de primer plano
  ctx.save();
  ctx.translate(-state.cameraX, 0);

  drawGroundedStreetProps(ctx, state, viewW);

  for (const wz of state.windZones) {
    drawWindZone(ctx, wz, state.time);
  }

  for (const plat of state.platforms) {
    if (plat.broken) continue;
    drawPlatform(ctx, plat, state.level.palette);
  }

  for (const h of state.hazards) {
    drawHazard(ctx, h, state.time);
  }

  for (const rope of state.ropes) {
    drawRopeVine(ctx, rope, state.time);
  }

  for (const ch of state.chalks) {
    drawChalkConstruct(ctx, ch, state.time);
  }

  // Meta: salida de cuadra, portal post-jefe o puerta del taller FRENAR®
  const showWorkshopSign =
    state.level.isFinalWorkshop || state.level.index >= 14;
  if (!state.level.isBossArena || state.bossDefeated) {
    drawLevelGoal(
      ctx,
      state.level.goalX,
      state.level.goalY,
      state.level.isBossArena ? state.bossDefeated : state.allPartsCollected,
      showWorkshopSign,
      state.time
    );
  }

  for (const b of state.bottles) {
    if (!b.collected) drawFluidBottle(ctx, b, state.time);
  }
  for (const heart of state.hearts) {
    if (!heart.collected) drawHeartPickup(ctx, heart, state.time);
  }
  for (const pt of state.parts) {
    if (!pt.collected) drawBrakePart(ctx, pt, state.time);
  }

  for (const e of state.enemies) {
    if (e.alive) drawEnemy(ctx, e, state.time);
  }
  for (const eproj of state.enemyProjectiles) {
    drawEnemyProjectile(ctx, eproj);
  }

  if (state.boss && state.boss.active) {
    drawBoss(ctx, state.boss, state.time);
  }
  for (const proj of state.bossProjectiles) {
    drawBossProjectile(ctx, proj);
  }

  // Fantasma de rebobinado de Lautaro
  if (state.characterId === 'lautaro' && state.rewindHistory.length > 2) {
    const ghostSample = state.rewindHistory[0];
    ctx.save();
    ctx.globalAlpha = 0.25;
    drawCharacterSprite(ctx, 'lautaro', {
      cx: ghostSample.x + state.player.w / 2,
      bottomY: ghostSample.y + state.player.h,
      facing: ghostSample.facing,
      walkCycle: 0,
      isMoving: false,
      onGround: true,
      vy: 0,
      time: state.time,
      powerActive: false,
      scale: 1,
    });
    ctx.restore();
  }

  if (state.dog.active) {
    drawWhiteDog(ctx, state.dog);
  }

  for (const wave of state.sonicWaves) {
    drawSonicWave(ctx, wave);
  }

  drawPlayer(ctx, state);

  drawParticles(ctx, state.particles);
  drawPopBursts(ctx, state.popBursts);
  drawAdditiveLights(ctx, state, viewW);

  ctx.restore();
  drawSeasonalWeather(ctx, viewW, VIRTUAL_H, state);
  ctx.restore();
}

/* ============================================================================
 *  LOGO OFICIAL FRENAR® (INCLINADO, ANGULAR, AMARILLO Y CON SÍMBOLO ®)
 * ========================================================================== */

export function drawFrenarLogo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale = 1
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Resplandor sutil amarillo
  ctx.shadowColor = 'rgba(255, 230, 0, 0.55)';
  ctx.shadowBlur = 16;

  // Franja inferior dinámica
  ctx.fillStyle = '#FFE600';
  ctx.strokeStyle = '#0B0F1A';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-124, 21);
  ctx.lineTo(106, 21);
  ctx.lineTo(100, 27);
  ctx.lineTo(-130, 27);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Tipografía inclinada hacia adelante y angulosa
  ctx.save();
  ctx.transform(1, 0, -0.25, 1, 0, 0);
  ctx.font = '900 42px "Bungee", "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#0B0F1A';
  ctx.strokeText('FRENAR', -10, -2);

  const grad = ctx.createLinearGradient(0, -22, 0, 18);
  grad.addColorStop(0, '#FFF566');
  grad.addColorStop(0.55, '#FFE600');
  grad.addColorStop(1, '#F59E0B');
  ctx.fillStyle = grad;
  ctx.fillText('FRENAR', -10, -2);
  ctx.restore();

  // Símbolo ® encerrado en círculo a la derecha
  ctx.shadowBlur = 0;
  ctx.save();
  ctx.translate(106, -12);
  ctx.fillStyle = '#0B0F1A';
  ctx.strokeStyle = '#FFE600';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, 11.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFE600';
  ctx.font = 'bold 13px "Fredoka", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('R', 0, 1);
  ctx.restore();

  ctx.restore();
}

/* ============================================================================
 *  FONDO ATMOSFÉRICO Y CIUDAD EN PARALAJE
 * ========================================================================== */

function drawSkyAndAtmosphere(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  state: RenderSceneState
): void {
  const { palette } = state.level;
  const isNight = palette.timeOfDay === 'night';
  const isSunset = palette.timeOfDay === 'sunset';
  const isMorning = palette.timeOfDay === 'morning';

  const skyGrad = ctx.createLinearGradient(0, 0, 0, viewH);
  skyGrad.addColorStop(0, palette.skyTop);
  skyGrad.addColorStop(0.55, palette.skyMid);
  skyGrad.addColorStop(1, palette.skyBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(-32, -32, viewW + 64, viewH + 64);

  if (isNight) {
    for (let s = 0; s < 36; s++) {
      const sx = ((s * 173 + 41) % (viewW + 40)) - 20;
      const sy = 22 + ((s * 67) % 195);
      const twinkle = 0.35 + Math.abs(Math.sin(state.time * 2.2 + s * 1.4)) * 0.65;
      ctx.fillStyle = `rgba(241, 245, 249, ${twinkle.toFixed(2)})`;
      ctx.fillRect(sx, sy, s % 3 === 0 ? 2.5 : 1.6, s % 3 === 0 ? 2.5 : 1.6);
    }
  }

  const celestialX =
    (isMorning ? viewW * 0.24 : isSunset ? viewW * 0.68 : viewW * 0.78) -
    state.cameraX * 0.03;
  const celestialY = isNight ? 114 : isSunset ? 215 : 124;
  const halo = ctx.createRadialGradient(
    celestialX,
    celestialY,
    14,
    celestialX,
    celestialY,
    isSunset ? 165 : 130
  );
  if (isNight) {
    halo.addColorStop(0, 'rgba(226, 232, 240, 0.92)');
    halo.addColorStop(0.35, 'rgba(148, 163, 184, 0.28)');
    halo.addColorStop(1, 'rgba(148, 163, 184, 0)');
  } else if (isSunset) {
    halo.addColorStop(0, 'rgba(255, 235, 160, 0.96)');
    halo.addColorStop(0.4, 'rgba(249, 115, 22, 0.38)');
    halo.addColorStop(1, 'rgba(249, 115, 22, 0)');
  } else {
    halo.addColorStop(0, 'rgba(255, 248, 204, 0.96)');
    halo.addColorStop(0.38, 'rgba(255, 212, 130, 0.30)');
    halo.addColorStop(1, 'rgba(255, 212, 130, 0)');
  }
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(celestialX, celestialY, isSunset ? 165 : 130, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isNight ? '#F1F5F9' : isSunset ? '#FDE047' : '#FFFBEB';
  ctx.beginPath();
  ctx.arc(celestialX, celestialY, isSunset ? 40 : 33, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isNight
    ? 'rgba(148, 163, 184, 0.14)'
    : isSunset
      ? 'rgba(254, 215, 170, 0.24)'
      : 'rgba(255, 255, 255, 0.36)';
  const cloudSpeed = palette.season === 'autumn' ? 18 : 8;
  for (let i = 0; i < 6; i++) {
    const cx =
      ((i * 340 - state.cameraX * 0.07 + state.time * cloudSpeed) % (viewW + 320)) -
      140;
    const cy = 78 + (i % 3) * 46;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 86, 24, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 34, cy + 8, 52, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 38, cy + 8, 56, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParallaxCity(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  state: RenderSceneState
): void {
  const { palette } = state.level;
  const isNight = palette.timeOfDay === 'night';
  const isSunset = palette.timeOfDay === 'sunset';
  const litWindows = isNight || isSunset;

  const farSpan = 210;
  const farStart = Math.floor((state.cameraX * 0.18) / farSpan) - 1;
  const farCount = Math.ceil(viewW / farSpan) + 3;

  for (let i = farStart; i < farStart + farCount; i++) {
    const bx = i * farSpan - state.cameraX * 0.18;
    const seed = Math.abs(Math.sin(i * 12.9898) * 43758.5453);
    const bh = 160 + (seed % 165);
    const bw = 175 + ((seed * 7) % 30);
    const by = viewH - 120 - bh;

    ctx.fillStyle = palette.buildingFar;
    ctx.fillRect(bx, by, bw, bh + 120);

    ctx.fillStyle = isNight
      ? 'rgba(253, 224, 71, 0.34)'
      : isSunset
        ? 'rgba(253, 186, 116, 0.28)'
        : 'rgba(226, 232, 240, 0.24)';
    for (let wy = by + 22; wy < viewH - 165; wy += 26) {
      for (let wx = bx + 18; wx < bx + bw - 22; wx += 24) {
        if (((Math.floor(wx + wy) + i) % 3) !== 0) {
          ctx.fillRect(wx, wy, 10, 14);
        }
      }
    }
  }

  const midSpan = 280;
  const midStart = Math.floor((state.cameraX * 0.42) / midSpan) - 1;
  const midCount = Math.ceil(viewW / midSpan) + 3;

  for (let i = midStart; i < midStart + midCount; i++) {
    const bx = i * midSpan - state.cameraX * 0.42;
    const seed = Math.abs(Math.cos(i * 7.13) * 19234.12);
    const bh = 210 + (seed % 180);
    const bw = 225;
    const by = viewH - 120 - bh;

    const bGrad = ctx.createLinearGradient(bx, by, bx + bw, by);
    bGrad.addColorStop(0, palette.buildingMid);
    bGrad.addColorStop(1, palette.buildingFar);
    ctx.fillStyle = bGrad;
    ctx.fillRect(bx, by, bw, bh + 120);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
    ctx.fillRect(bx - 4, by, bw + 8, 10);

    for (let wy = by + 26; wy < viewH - 205; wy += 44) {
      for (let wx = bx + 22; wx < bx + bw - 34; wx += 48) {
        ctx.fillStyle = litWindows
          ? ((i + wx + wy) % 4 === 0
              ? 'rgba(250, 204, 21, 0.62)'
              : 'rgba(15, 23, 42, 0.48)')
          : 'rgba(30, 41, 59, 0.28)';
        ctx.fillRect(wx, wy, 26, 30);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(wx, wy, 26, 6);
      }
    }

    // Letrero neón sutil en locales nocturnos
    if (isNight && i % 2 === 0) {
      ctx.fillStyle = i % 4 === 0 ? 'rgba(0, 229, 255, 0.55)' : 'rgba(255, 45, 135, 0.52)';
      ctx.fillRect(bx + 36, viewH - 216, 84, 9);
    }

    const awningColor =
      i % 2 === 0 ? 'rgba(190, 60, 80, 0.55)' : 'rgba(40, 120, 145, 0.55)';
    ctx.fillStyle = awningColor;
    ctx.beginPath();
    ctx.moveTo(bx + 14, viewH - 188);
    ctx.lineTo(bx + bw - 14, viewH - 188);
    ctx.lineTo(bx + bw - 6, viewH - 166);
    ctx.lineTo(bx + 6, viewH - 166);
    ctx.closePath();
    ctx.fill();
  }
}

/* ============================================================================
 *  PROPS URBANOS ANCLADOS AL SUELO
 * ========================================================================== */

function drawGroundedStreetProps(
  ctx: CanvasRenderingContext2D,
  state: RenderSceneState,
  viewW: number
): void {
  const groundPlats = state.platforms.filter((p) => p.kind === 'ground');
  const minVisX = state.cameraX - 180;
  const maxVisX = state.cameraX + viewW + 180;

  for (const g of groundPlats) {
    for (let px = g.x + 110; px < g.x + g.w - 110; px += 340) {
      if (px < minVisX || px > maxVisX) continue;
      const idx = Math.floor(px / 340);

      const blockedByArch = state.platforms.some(
        (other) =>
          other !== g &&
          !other.oneWay &&
          px > other.x - 45 &&
          px < other.x + other.w + 45
      );
      if (blockedByArch) continue;

      if (idx % 2 === 0) {
        drawGroundedTree(ctx, px, g.y, g.surface === 'grass', state.level.palette.season);
      } else {
        drawGroundedStreetLamp(
          ctx,
          px,
          g.y,
          state.level.palette.timeOfDay === 'sunset' ||
            state.level.palette.timeOfDay === 'night'
        );
      }
    }
  }
}

function drawGroundedTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  onGrass: boolean,
  season: SeasonType
): void {
  if (!onGrass) {
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.fillRect(x - 24, groundY - 12, 48, 12);
    ctx.strokeRect(x - 24, groundY - 12, 48, 12);
    ctx.fillStyle = '#3E2723';
    ctx.fillRect(x - 20, groundY - 15, 40, 5);
  }

  const baseY = onGrass ? groundY + 2 : groundY - 12;

  ctx.fillStyle = 'rgba(10, 12, 24, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x, groundY + 4, 42, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  const trunkGrad = ctx.createLinearGradient(x - 14, baseY - 110, x + 14, baseY);
  trunkGrad.addColorStop(0, '#78492A');
  trunkGrad.addColorStop(0.55, '#5C341B');
  trunkGrad.addColorStop(1, '#3B1F0E');
  ctx.fillStyle = trunkGrad;
  ctx.strokeStyle = '#1E1108';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - 13, baseY);
  ctx.quadraticCurveTo(x - 9, baseY - 56, x - 7, baseY - 108);
  ctx.lineTo(x + 7, baseY - 108);
  ctx.quadraticCurveTo(x + 9, baseY - 56, x + 13, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const blobs =
    season === 'autumn'
      ? [
          { dx: -26, dy: -116, r: 34, c1: '#FB923C', c2: '#9A3412' },
          { dx: 26, dy: -114, r: 32, c1: '#FACC15', c2: '#B45309' },
          { dx: 0, dy: -140, r: 42, c1: '#F87171', c2: '#991B1B' },
        ]
      : season === 'winter'
        ? [
            { dx: -26, dy: -116, r: 32, c1: '#64748B', c2: '#1E293B' },
            { dx: 26, dy: -114, r: 30, c1: '#94A3B8', c2: '#334155' },
            { dx: 0, dy: -140, r: 38, c1: '#CBD5E1', c2: '#334155' },
          ]
        : [
            { dx: -26, dy: -116, r: 34, c1: '#4CAF50', c2: '#1B5E20' },
            { dx: 26, dy: -114, r: 32, c1: '#66BB6A', c2: '#2E7D32' },
            { dx: 0, dy: -140, r: 42, c1: '#81C784', c2: '#256029' },
          ];
  for (const b of blobs) {
    const g = ctx.createRadialGradient(
      x + b.dx - 10,
      baseY + b.dy - 12,
      6,
      x + b.dx,
      baseY + b.dy,
      b.r
    );
    g.addColorStop(0, b.c1);
    g.addColorStop(1, b.c2);
    ctx.fillStyle = g;
    ctx.strokeStyle = season === 'autumn' ? '#431407' : season === 'winter' ? '#0F172A' : '#113815';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x + b.dx, baseY + b.dy, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (season === 'spring') {
    ctx.fillStyle = '#FBCFE8';
    for (let f = 0; f < 5; f++) {
      ctx.beginPath();
      ctx.arc(x - 24 + f * 12, baseY - 124 + (f % 2) * 14, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawGroundedStreetLamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  isLit: boolean
): void {
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 10, groundY);
  ctx.lineTo(x + 10, groundY);
  ctx.lineTo(x + 6, groundY - 22);
  ctx.lineTo(x - 6, groundY - 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.fillRect(x - 3.5, groundY - 178, 7, 156);
  ctx.strokeRect(x - 3.5, groundY - 178, 7, 156);

  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, groundY - 176);
  ctx.quadraticCurveTo(x + 14, groundY - 196, x + 28, groundY - 186);
  ctx.stroke();

  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.ellipse(x + 30, groundY - 186, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isLit ? '#FEF08A' : '#CBD5E1';
  ctx.beginPath();
  ctx.arc(x + 30, groundY - 181, 6, 0, Math.PI);
  ctx.fill();
}

/* ============================================================================
 *  PLATAFORMAS Y PELIGROS
 * ========================================================================== */

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  p: Platform,
  palette: LevelDefinition['palette']
): void {
  const x = p.x;
  const y = p.y + (p.bounceCompression ?? 0) * 6;
  const w = p.w;
  const h = p.h;

  if (p.kind !== 'ground') {
    ctx.fillStyle = 'rgba(10, 8, 22, 0.25)';
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 6, w, h, 7);
    ctx.fill();
  }

  if (p.kind === 'bounce') {
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#0B0F1A';
    ctx.lineWidth = 2.5;
    ctx.fillRect(x + 10, y + 12, w - 20, h - 12);
    ctx.strokeRect(x + 10, y + 12, w - 20, h - 12);

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 18, y + h - 4);
    ctx.lineTo(x + w - 18, y + 18);
    ctx.lineTo(x + 18, y + 14);
    ctx.stroke();

    const topG = ctx.createLinearGradient(x, y, x, y + 14);
    topG.addColorStop(0, '#FF4D94');
    topG.addColorStop(1, '#BE185D');
    ctx.fillStyle = topG;
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 14, 6);
    ctx.fill();
    ctx.stroke();
    return;
  }

  if (p.kind === 'breakable') {
    const bGrad = ctx.createLinearGradient(x, y, x + w, y);
    bGrad.addColorStop(0, '#F59E0B');
    bGrad.addColorStop(1, '#B45309');
    ctx.fillStyle = bGrad;
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, y + 2, w - 4, h - 4);
    ctx.clip();
    ctx.fillStyle = '#110B1E';
    for (let sy = y - 20; sy < y + h + 20; sy += 22) {
      ctx.beginPath();
      ctx.moveTo(x, sy);
      ctx.lineTo(x + w, sy + 16);
      ctx.lineTo(x + w, sy + 26);
      ctx.lineTo(x, sy + 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  const surface = p.surface ?? (p.kind === 'ground' ? 'asphalt' : 'metal');
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#0F111A';

  if (surface === 'grass') {
    const soilGrad = ctx.createLinearGradient(x, y + 14, x, y + h);
    soilGrad.addColorStop(0, '#6A4128');
    soilGrad.addColorStop(1, '#3B2214');
    ctx.fillStyle = soilGrad;
    ctx.beginPath();
    ctx.roundRect(x, y + 12, w, h - 12, p.kind === 'ground' ? 0 : 8);
    ctx.fill();
    ctx.stroke();

    const grassGrad = ctx.createLinearGradient(x, y, x, y + 18);
    grassGrad.addColorStop(0, '#65C43F');
    grassGrad.addColorStop(1, '#2D7A1E');
    ctx.fillStyle = grassGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 18, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(220, 252, 162, 0.45)';
    ctx.fillRect(x + 4, y + 2, w - 8, 3);
  } else if (surface === 'asphalt') {
    const aspGrad = ctx.createLinearGradient(x, y, x, y + h);
    aspGrad.addColorStop(0, '#363C4D');
    aspGrad.addColorStop(0.25, '#252A36');
    aspGrad.addColorStop(1, '#161922');
    ctx.fillStyle = aspGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, p.kind === 'ground' ? 0 : 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(x + 1, y + 1, w - 2, 9);
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(x + 2, y + 1, w - 4, 3);

    if (w >= 260) {
      ctx.fillStyle = palette.platformStripe;
      for (let lx = x + 36; lx < x + w - 50; lx += 84) {
        ctx.fillRect(lx, y + 22, 42, 4);
      }
    }

    // Cartel discreto de paso bajo cuando es un túnel para agacharse
    if (p.id.includes('arch')) {
      ctx.fillStyle = '#FFE600';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.5;
      ctx.font = 'bold 11px "Bungee", sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText('↓ AGÁCHATE', x + w / 2, y + h - 10);
      ctx.fillText('↓ AGÁCHATE', x + w / 2, y + h - 10);
    }
  } else if (surface === 'ice') {
    const iceGrad = ctx.createLinearGradient(x, y, x, y + h);
    iceGrad.addColorStop(0, '#E0F7FA');
    iceGrad.addColorStop(0.28, '#67E8F9');
    iceGrad.addColorStop(0.68, '#0891B2');
    iceGrad.addColorStop(1, '#164E63');
    ctx.fillStyle = iceGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, p.kind === 'ground' ? 0 : 7);
    ctx.fill();
    ctx.stroke();

    // Brillo superior congelado
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.fillRect(x + 2, y + 1, w - 4, 6);

    // Reflejos diagonales cristalinos
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, y + 2, w - 4, h - 4);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
    for (let sx = x - 20; sx < x + w + 20; sx += 58) {
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx + 16, y);
      ctx.lineTo(sx - 6, y + Math.min(34, h));
      ctx.lineTo(sx - 22, y + Math.min(34, h));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Carámbanos colgantes en plataformas flotantes de hielo
    if (p.kind !== 'ground') {
      ctx.fillStyle = '#A5F3FC';
      ctx.strokeStyle = '#0E7490';
      ctx.lineWidth = 1.6;
      for (let ix = x + 18; ix < x + w - 16; ix += 34) {
        const icicleH = 9 + ((ix * 7) % 8);
        ctx.beginPath();
        ctx.moveTo(ix - 5, y + h);
        ctx.lineTo(ix + 5, y + h);
        ctx.lineTo(ix, y + h + icicleH);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  } else {
    const metGrad = ctx.createLinearGradient(x, y, x, y + h);
    metGrad.addColorStop(0, '#94A3B8');
    metGrad.addColorStop(0.35, '#475569');
    metGrad.addColorStop(1, '#1E293B');
    ctx.fillStyle = metGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = p.kind === 'moving' ? '#38BDF8' : '#E2E8F0';
    ctx.fillRect(x + 4, y + 2, w - 8, 3.5);

    ctx.fillStyle = '#0F172A';
    for (let rx = x + 16; rx < x + w - 12; rx += 36) {
      ctx.beginPath();
      ctx.arc(rx, y + h * 0.58, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawWindZone(
  ctx: CanvasRenderingContext2D,
  wz: WindZone,
  time: number
): void {
  const dir = wz.forceX >= 0 ? 1 : -1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(wz.x, wz.y, wz.w, wz.h);
  ctx.clip();

  const bgGrad = ctx.createLinearGradient(
    dir > 0 ? wz.x : wz.x + wz.w,
    wz.y,
    dir > 0 ? wz.x + wz.w : wz.x,
    wz.y
  );
  bgGrad.addColorStop(0, 'rgba(56, 189, 248, 0.04)');
  bgGrad.addColorStop(0.5, 'rgba(186, 230, 253, 0.14)');
  bgGrad.addColorStop(1, 'rgba(56, 189, 248, 0.04)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(wz.x, wz.y, wz.w, wz.h);

  // Líneas de ráfagas rápidas con flechas y rizos
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const speed = 430 + (i % 4) * 55;
    const rawX = ((time * speed * dir + i * 78) % (wz.w + 160));
    const sx = wz.x + (rawX < 0 ? rawX + wz.w + 160 : rawX) - 80;
    const sy = wz.y + 34 + ((i * 53) % Math.max(40, wz.h - 56));
    const waveY = Math.sin(time * 8 + i) * 6;

    ctx.strokeStyle =
      i % 3 === 0 ? 'rgba(255, 255, 255, 0.65)' : 'rgba(186, 230, 253, 0.48)';
    ctx.lineWidth = i % 3 === 0 ? 2.6 : 1.9;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + dir * 32, sy + waveY, sx + dir * 68, sy - waveY * 0.5);
    ctx.stroke();

    // Punta de flecha clara
    const tipX = sx + dir * 68;
    const tipY = sy - waveY * 0.5;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - dir * 9, tipY - 4.5);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - dir * 9, tipY + 4.5);
    ctx.stroke();
  }

  // Cartel superior discreto indicando la dirección del viento
  const badgeLabel = dir > 0 ? 'VIENTO ►►' : '◄◄ VIENTO';
  ctx.font = 'bold 11px "Bungee", sans-serif';
  ctx.textAlign = 'center';
  const bx = wz.x + wz.w / 2;
  const by = wz.y + 18;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.68)';
  ctx.beginPath();
  ctx.roundRect(bx - 52, by - 12, 104, 18, 6);
  ctx.fill();
  ctx.fillStyle = '#BAE6FD';
  ctx.fillText(badgeLabel, bx, by + 1);

  ctx.restore();
}

function drawRopeVine(
  ctx: CanvasRenderingContext2D,
  rope: RopeState,
  time: number
): void {
  const nodes = rope.nodes;
  if (!nodes || nodes.length < 2) return;
  const tip = nodes[nodes.length - 1];

  const traceCurve = (offsetX: number, offsetY: number) => {
    ctx.beginPath();
    ctx.moveTo(nodes[0].x + offsetX, nodes[0].y + offsetY);
    for (let i = 1; i < nodes.length - 1; i++) {
      const mx = (nodes[i].x + nodes[i + 1].x) * 0.5 + offsetX;
      const my = (nodes[i].y + nodes[i + 1].y) * 0.5 + offsetY;
      ctx.quadraticCurveTo(nodes[i].x + offsetX, nodes[i].y + offsetY, mx, my);
    }
    ctx.lineTo(tip.x + offsetX, tip.y + offsetY);
  };

  ctx.save();
  // Anclaje superior metálico o rama
  ctx.fillStyle = rope.kind === 'vine' ? '#5C341B' : '#334155';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(rope.x - 16, rope.anchorY - 12, 32, 14, 4);
  ctx.fill();
  ctx.stroke();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Sombra sutil proyectada
  ctx.strokeStyle = 'rgba(0,0,0,0.26)';
  ctx.lineWidth = rope.kind === 'vine' ? 9 : 7;
  traceCurve(3, 3);
  ctx.stroke();

  // Contorno oscuro exterior
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = rope.kind === 'vine' ? 9.5 : 7.5;
  traceCurve(0, 0);
  ctx.stroke();

  // Cuerpo principal de la liana o cable trenzado
  ctx.strokeStyle = rope.kind === 'vine' ? '#3F7D20' : '#64748B';
  ctx.lineWidth = rope.kind === 'vine' ? 6.5 : 4.8;
  traceCurve(0, 0);
  ctx.stroke();

  // Brillo o veta trenzada
  ctx.strokeStyle = rope.kind === 'vine' ? '#84CC16' : '#E2E8F0';
  ctx.lineWidth = 2;
  if (rope.kind === 'cable') {
    ctx.setLineDash([7, 5]);
  }
  traceCurve(-0.8, 0);
  ctx.stroke();
  ctx.setLineDash([]);

  // Hojas orientadas según la curvatura real de la liana
  if (rope.kind === 'vine') {
    for (let i = 2; i < nodes.length - 1; i += 2) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      const ang = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      const side = (i / 2) % 2 === 0 ? 1 : -1;
      const sway = Math.sin(time * 3.5 + i) * 0.14;
      ctx.save();
      ctx.translate(curr.x, curr.y);
      ctx.rotate(ang - Math.PI / 2 + side * 0.55 + sway);
      ctx.fillStyle = '#4ADE80';
      ctx.strokeStyle = '#14532D';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(side * 7, 0, 7.5, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // Nudo o manija inferior para agarrarse fácil
  ctx.fillStyle = rope.kind === 'vine' ? '#84CC16' : '#FFE600';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(tip.x - 2.5, tip.y - 2.5, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawHazard(
  ctx: CanvasRenderingContext2D,
  h: HazardZone,
  time: number
): void {
  if (h.type === 'ice_column') {
    drawIceColumnTrap(ctx, h, time);
    return;
  }
  if (h.type === 'updraft') {
    drawUpdraftVentTrap(ctx, h, time);
    return;
  }
  if (h.type === 'suction') {
    drawSuctionPitTrap(ctx, h, time);
    return;
  }

  if (h.type === 'water') {
    const wGrad = ctx.createLinearGradient(h.x, h.y, h.x, h.y + h.h);
    wGrad.addColorStop(0, 'rgba(14, 165, 233, 0.88)');
    wGrad.addColorStop(0.5, 'rgba(3, 105, 161, 0.94)');
    wGrad.addColorStop(1, 'rgba(12, 44, 82, 0.98)');

    ctx.fillStyle = wGrad;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y + h.h);
    for (let wx = h.x; wx <= h.x + h.w; wx += 14) {
      const waveY = h.y + Math.sin(wx * 0.06 + time * 4.5) * 3.5;
      ctx.lineTo(wx, waveY);
    }
    ctx.lineTo(h.x + h.w, h.y + h.h);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(186, 230, 253, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let wx = h.x; wx <= h.x + h.w; wx += 14) {
      const waveY = h.y + Math.sin(wx * 0.06 + time * 4.5) * 3.5;
      if (wx === h.x) ctx.moveTo(wx, waveY);
      else ctx.lineTo(wx, waveY);
    }
    ctx.stroke();
  } else {
    const firePhase = getPulsingFirePhase(h, time);
    const dir = h.direction ?? 'up';

    if (h.isSprinkler) {
      drawFireSprinkler(ctx, h, dir, firePhase, time);
      return;
    }

    // Fosa continua de fuego (huecos del suelo)
    ctx.fillStyle = firePhase.state === 'embers' ? '#451A03' : '#29150E';
    ctx.fillRect(h.x, h.y + h.h - 10, h.w, 10);
    ctx.fillStyle = firePhase.state === 'warning' ? '#F97316' : '#EA580C';
    for (let cx = h.x + 8; cx < h.x + h.w - 8; cx += 18) {
      ctx.fillRect(cx, h.y + h.h - 8, 10, 4);
    }

    const flameCount = Math.max(4, Math.floor(h.w / 16));
    for (let i = 0; i < flameCount; i++) {
      const fx = h.x + (i + 0.5) * (h.w / flameCount);
      const sway = Math.sin(time * 9 + i * 1.7) * 5;
      const fh = h.h * (0.88 + Math.sin(time * 12 + i * 2.3) * 0.2);

      const fGrad = ctx.createLinearGradient(fx, h.y + h.h, fx + sway, h.y + h.h - fh);
      fGrad.addColorStop(0, '#DC2626');
      fGrad.addColorStop(0.5, '#F97316');
      fGrad.addColorStop(1, '#FACC15');

      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.moveTo(fx - 12, h.y + h.h - 2);
      ctx.quadraticCurveTo(fx - 14, h.y + h.h - fh * 0.55, fx + sway, h.y + h.h - fh);
      ctx.quadraticCurveTo(fx + 14, h.y + h.h - fh * 0.55, fx + 12, h.y + h.h - 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FEF9C3';
      ctx.beginPath();
      ctx.moveTo(fx - 5, h.y + h.h - 2);
      ctx.quadraticCurveTo(fx - 5, h.y + h.h - fh * 0.38, fx + sway * 0.6, h.y + h.h - fh * 0.62);
      ctx.quadraticCurveTo(fx + 5, h.y + h.h - fh * 0.38, fx + 5, h.y + h.h - 2);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawFireSprinkler(
  ctx: CanvasRenderingContext2D,
  h: HazardZone,
  dir: 'up' | 'down' | 'left' | 'right',
  firePhase: { state: 'embers' | 'warning' | 'active'; intensity: number; progress: number },
  time: number
): void {
  const isVertical = dir === 'up' || dir === 'down';
  const blink = Math.sin(time * 20) > 0;
  const ledColor =
    firePhase.state === 'active'
      ? '#EF4444'
      : firePhase.state === 'warning'
        ? blink
          ? '#FACC15'
          : '#F97316'
        : '#22C55E';

  ctx.save();

  // 1. Llamas / pre-encendido (detrás de la boquilla metálica)
  if (firePhase.state === 'warning') {
    // Guía sutil de trayectoria térmica + chispas crecientes desde los aspersores
    ctx.save();
    ctx.strokeStyle = `rgba(251, 146, 60, ${0.18 + firePhase.progress * 0.28})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = -time * 40;
    ctx.strokeRect(h.x + 4, h.y + 4, h.w - 8, h.h - 8);
    ctx.restore();

    const previewLen = 28 + firePhase.progress * 44;
    const nozzleCount = isVertical ? Math.max(3, Math.floor(h.w / 24)) : Math.max(4, Math.floor(h.h / 56));
    for (let i = 0; i < nozzleCount; i++) {
      const flicker = Math.sin(time * 28 + i * 2.1) * 8;
      if (isVertical) {
        const nx = h.x + (i + 0.5) * (h.w / nozzleCount);
        const baseY = dir === 'up' ? h.y + h.h - 10 : h.y + 10;
        const tipY = dir === 'up' ? baseY - previewLen - flicker : baseY + previewLen + flicker;
        ctx.fillStyle = i % 2 === 0 ? '#F97316' : '#FACC15';
        ctx.beginPath();
        ctx.moveTo(nx - 8, baseY);
        ctx.lineTo(nx + flicker * 0.3, tipY);
        ctx.lineTo(nx + 8, baseY);
        ctx.closePath();
        ctx.fill();
      } else {
        const ny = h.y + (i + 0.5) * (h.h / nozzleCount);
        const baseX = dir === 'right' ? h.x + 10 : h.x + h.w - 10;
        const tipX = dir === 'right' ? baseX + previewLen + flicker : baseX - previewLen - flicker;
        ctx.fillStyle = i % 2 === 0 ? '#F97316' : '#FACC15';
        ctx.beginPath();
        ctx.moveTo(baseX, ny - 10);
        ctx.lineTo(tipX, ny + flicker * 0.3);
        ctx.lineTo(baseX, ny + 10);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Cartel de aviso claro de pre-encendido
    const warnX = h.x + h.w / 2;
    const warnY = dir === 'down' ? h.y + 68 : dir === 'up' ? 500 : h.y + h.h / 2;
    ctx.save();
    ctx.fillStyle = blink ? '#FFE600' : '#FB923C';
    ctx.strokeStyle = '#090D16';
    ctx.lineWidth = 3.5;
    ctx.font = 'bold 14px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText('¡FUEGO!', warnX, warnY);
    ctx.fillText('¡FUEGO!', warnX, warnY);
    ctx.restore();
  } else if (firePhase.state === 'active') {
    // COLUMNA / CHORRO TOTAL DE FUEGO QUE BLOQUEA COMPLETAMENTE EL PASO
    if (isVertical) {
      const startY = dir === 'up' ? h.y + h.h : h.y;
      const endY = dir === 'up' ? h.y : h.y + h.h;

      const outerGrad = ctx.createLinearGradient(h.x, startY, h.x, endY);
      outerGrad.addColorStop(0, '#FEF08A');
      outerGrad.addColorStop(0.14, '#F97316');
      outerGrad.addColorStop(0.62, '#DC2626');
      outerGrad.addColorStop(1, 'rgba(234, 88, 12, 0.92)');

      // Cuerpo principal ondulante que llena todo el ancho y alto del bloqueo
      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      const steps = 18;
      ctx.moveTo(h.x + 2, startY);
      for (let s = 0; s <= steps; s++) {
        const ratio = s / steps;
        const py = startY + (endY - startY) * ratio;
        const wave = Math.sin(time * 22 + ratio * 12) * 5.5;
        ctx.lineTo(h.x + 4 + wave, py);
      }
      for (let s = steps; s >= 0; s--) {
        const ratio = s / steps;
        const py = startY + (endY - startY) * ratio;
        const wave = Math.cos(time * 24 + ratio * 11) * 5.5;
        ctx.lineTo(h.x + h.w - 4 + wave, py);
      }
      ctx.closePath();
      ctx.fill();

      // Chorros internos intensos por cada boquilla + núcleo incandescente
      const jetCount = Math.max(3, Math.floor(h.w / 28));
      for (let j = 0; j < jetCount; j++) {
        const jx = h.x + (j + 0.5) * (h.w / jetCount);
        const jetW = (h.w / jetCount) * 0.56;
        ctx.fillStyle = 'rgba(250, 204, 21, 0.72)';
        ctx.beginPath();
        ctx.moveTo(jx - jetW * 0.65, startY);
        for (let s = 1; s <= 12; s++) {
          const ratio = s / 12;
          const py = startY + (endY - startY) * ratio;
          const sw = Math.sin(time * 26 + ratio * 14 + j * 1.9) * 5;
          ctx.lineTo(jx + sw - jetW * 0.4, py);
        }
        for (let s = 12; s >= 1; s--) {
          const ratio = s / 12;
          const py = startY + (endY - startY) * ratio;
          const sw = Math.sin(time * 26 + ratio * 14 + j * 1.9) * 5;
          ctx.lineTo(jx + sw + jetW * 0.4, py);
        }
        ctx.closePath();
        ctx.fill();

        // Núcleo blanco-amarillo brillante a lo largo de todo el chorro
        ctx.fillStyle = 'rgba(254, 249, 195, 0.92)';
        ctx.beginPath();
        ctx.moveTo(jx - jetW * 0.24, startY);
        for (let s = 1; s <= 10; s++) {
          const ratio = s / 10;
          const py = startY + (endY - startY) * ratio;
          const sw = Math.sin(time * 30 + ratio * 15 + j * 2.3) * 3;
          ctx.lineTo(jx + sw - jetW * 0.14, py);
        }
        for (let s = 10; s >= 1; s--) {
          const ratio = s / 10;
          const py = startY + (endY - startY) * ratio;
          const sw = Math.sin(time * 30 + ratio * 15 + j * 2.3) * 3;
          ctx.lineTo(jx + sw + jetW * 0.14, py);
        }
        ctx.closePath();
        ctx.fill();
      }

      // Explosión de impacto en el suelo cuando baja del techo
      if (dir === 'down') {
        for (let f = 0; f < 5; f++) {
          const fx = h.x + (f + 0.5) * (h.w / 5);
          const r = 12 + Math.sin(time * 24 + f) * 4;
          ctx.fillStyle = 'rgba(251, 146, 60, 0.85)';
          ctx.beginPath();
          ctx.ellipse(fx, h.y + h.h - 4, r, 7, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // CHORRO HORIZONTAL ANCHO DE PARED (izquierda o derecha)
      const startX = dir === 'right' ? h.x : h.x + h.w;
      const endX = dir === 'right' ? h.x + h.w : h.x;

      const hGrad = ctx.createLinearGradient(startX, h.y, endX, h.y);
      hGrad.addColorStop(0, '#FEF08A');
      hGrad.addColorStop(0.16, '#F97316');
      hGrad.addColorStop(0.68, '#DC2626');
      hGrad.addColorStop(1, 'rgba(234, 88, 12, 0.9)');

      ctx.fillStyle = hGrad;
      ctx.beginPath();
      const steps = 16;
      ctx.moveTo(startX, h.y + 4);
      for (let s = 0; s <= steps; s++) {
        const ratio = s / steps;
        const px = startX + (endX - startX) * ratio;
        const wave = Math.sin(time * 22 + ratio * 10) * 6;
        ctx.lineTo(px, h.y + 4 + wave);
      }
      for (let s = steps; s >= 0; s--) {
        const ratio = s / steps;
        const px = startX + (endX - startX) * ratio;
        const wave = Math.cos(time * 24 + ratio * 10) * 6;
        ctx.lineTo(px, h.y + h.h - 4 + wave);
      }
      ctx.closePath();
      ctx.fill();

      const jetCount = Math.max(4, Math.floor(h.h / 58));
      for (let j = 0; j < jetCount; j++) {
        const jy = h.y + (j + 0.5) * (h.h / jetCount);
        const jetH = (h.h / jetCount) * 0.58;
        ctx.fillStyle = 'rgba(250, 204, 21, 0.78)';
        ctx.beginPath();
        ctx.moveTo(startX, jy - jetH * 0.55);
        for (let s = 1; s <= 10; s++) {
          const ratio = s / 10;
          const px = startX + (endX - startX) * ratio;
          const sw = Math.sin(time * 28 + ratio * 12 + j * 1.7) * 5;
          ctx.lineTo(px, jy + sw - jetH * 0.35);
        }
        for (let s = 10; s >= 1; s--) {
          const ratio = s / 10;
          const px = startX + (endX - startX) * ratio;
          const sw = Math.sin(time * 28 + ratio * 12 + j * 1.7) * 5;
          ctx.lineTo(px, jy + sw + jetH * 0.35);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(254, 249, 195, 0.94)';
        ctx.beginPath();
        ctx.moveTo(startX, jy - jetH * 0.22);
        for (let s = 1; s <= 8; s++) {
          const ratio = s / 8;
          const px = startX + (endX - startX) * ratio;
          const sw = Math.sin(time * 32 + ratio * 13 + j * 2.1) * 3;
          ctx.lineTo(px, jy + sw - jetH * 0.12);
        }
        for (let s = 8; s >= 1; s--) {
          const ratio = s / 8;
          const px = startX + (endX - startX) * ratio;
          const sw = Math.sin(time * 32 + ratio * 13 + j * 2.1) * 3;
          ctx.lineTo(px, jy + sw + jetH * 0.12);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // 2. Hardware del aspersor / surtidor industrial (siempre visible en el suelo, techo o pared)
  if (dir === 'up') {
    const baseY = h.y + h.h - 14;
    const metalG = ctx.createLinearGradient(h.x, baseY, h.x, baseY + 16);
    metalG.addColorStop(0, '#64748B');
    metalG.addColorStop(1, '#1E293B');
    ctx.fillStyle = metalG;
    ctx.strokeStyle = '#090D16';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(h.x - 6, baseY, h.w + 12, 16, 4);
    ctx.fill();
    ctx.stroke();

    const nozzles = Math.max(3, Math.floor(h.w / 26));
    for (let i = 0; i < nozzles; i++) {
      const nx = h.x + (i + 0.5) * (h.w / nozzles);
      ctx.fillStyle = '#D97706';
      ctx.fillRect(nx - 6, baseY - 6, 12, 8);
      ctx.strokeRect(nx - 6, baseY - 6, 12, 8);
      ctx.fillStyle = firePhase.state === 'embers' ? '#F97316' : '#FEF08A';
      ctx.fillRect(nx - 3, baseY - 8, 6, 3);
    }

    ctx.fillStyle = ledColor;
    ctx.beginPath();
    ctx.arc(h.x + h.w / 2, baseY + 8, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (dir === 'down') {
    const topY = h.y - 6;
    // Tubos de suministro superiores anclados al techo de pantalla
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#090D16';
    ctx.lineWidth = 2.5;
    ctx.fillRect(h.x + 14, -10, 12, topY + 14);
    ctx.strokeRect(h.x + 14, -10, 12, topY + 14);
    ctx.fillRect(h.x + h.w - 26, -10, 12, topY + 14);
    ctx.strokeRect(h.x + h.w - 26, -10, 12, topY + 14);

    const metalG = ctx.createLinearGradient(h.x, topY, h.x, topY + 18);
    metalG.addColorStop(0, '#1E293B');
    metalG.addColorStop(1, '#64748B');
    ctx.fillStyle = metalG;
    ctx.beginPath();
    ctx.roundRect(h.x - 6, topY, h.w + 12, 18, 4);
    ctx.fill();
    ctx.stroke();

    const nozzles = Math.max(3, Math.floor(h.w / 26));
    for (let i = 0; i < nozzles; i++) {
      const nx = h.x + (i + 0.5) * (h.w / nozzles);
      ctx.fillStyle = '#D97706';
      ctx.fillRect(nx - 6, topY + 16, 12, 8);
      ctx.strokeRect(nx - 6, topY + 16, 12, 8);
      ctx.fillStyle = firePhase.state === 'embers' ? '#F97316' : '#FEF08A';
      ctx.fillRect(nx - 3, topY + 23, 6, 3);
    }

    ctx.fillStyle = ledColor;
    ctx.beginPath();
    ctx.arc(h.x + h.w / 2, topY + 9, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Torre/pared metálica anclada al suelo con aspersores laterales
    const colX = dir === 'right' ? h.x - 16 : h.x + h.w - 2;
    const colG = ctx.createLinearGradient(colX, h.y, colX + 18, h.y);
    colG.addColorStop(0, '#334155');
    colG.addColorStop(0.5, '#64748B');
    colG.addColorStop(1, '#1E293B');
    ctx.fillStyle = colG;
    ctx.strokeStyle = '#090D16';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(colX, h.y - 10, 18, 604 - (h.y - 10), 4);
    ctx.fill();
    ctx.stroke();

    const nozzles = Math.max(4, Math.floor(h.h / 58));
    for (let i = 0; i < nozzles; i++) {
      const ny = h.y + (i + 0.5) * (h.h / nozzles);
      const nx = dir === 'right' ? colX + 16 : colX - 8;
      ctx.fillStyle = '#D97706';
      ctx.fillRect(nx, ny - 7, 10, 14);
      ctx.strokeRect(nx, ny - 7, 10, 14);
    }

    ctx.fillStyle = ledColor;
    ctx.beginPath();
    ctx.arc(colX + 9, h.y + 8, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawIceColumnTrap(
  ctx: CanvasRenderingContext2D,
  h: HazardZone,
  time: number
): void {
  const phase = getPulsingTrapPhase(h, time);
  const dir = h.direction ?? 'up';
  const isVertical = dir === 'up' || dir === 'down';
  const blink = Math.sin(time * 20) > 0;
  const ledColor =
    phase.state === 'active'
      ? '#38BDF8'
      : phase.state === 'warning'
        ? blink
          ? '#E0F2FE'
          : '#0284C7'
        : '#22C55E';

  ctx.save();

  if (phase.state === 'warning') {
    ctx.save();
    ctx.strokeStyle = `rgba(125, 211, 252, ${0.22 + phase.progress * 0.32})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = -time * 42;
    ctx.strokeRect(h.x + 4, h.y + 4, h.w - 8, h.h - 8);
    ctx.restore();

    const previewLen = 26 + phase.progress * 48;
    const nozzleCount = isVertical
      ? Math.max(3, Math.floor(h.w / 24))
      : Math.max(4, Math.floor(h.h / 56));
    for (let i = 0; i < nozzleCount; i++) {
      const shimmer = Math.sin(time * 24 + i * 1.9) * 6;
      if (isVertical) {
        const nx = h.x + (i + 0.5) * (h.w / nozzleCount);
        const baseY = dir === 'up' ? h.y + h.h - 10 : h.y + 10;
        const tipY =
          dir === 'up'
            ? baseY - previewLen - shimmer
            : baseY + previewLen + shimmer;
        ctx.fillStyle = i % 2 === 0 ? '#7DD3FC' : '#E0F2FE';
        ctx.beginPath();
        ctx.moveTo(nx - 8, baseY);
        ctx.lineTo(nx + shimmer * 0.25, tipY);
        ctx.lineTo(nx + 8, baseY);
        ctx.closePath();
        ctx.fill();
      } else {
        const ny = h.y + (i + 0.5) * (h.h / nozzleCount);
        const baseX = dir === 'right' ? h.x + 10 : h.x + h.w - 10;
        const tipX =
          dir === 'right'
            ? baseX + previewLen + shimmer
            : baseX - previewLen - shimmer;
        ctx.fillStyle = i % 2 === 0 ? '#7DD3FC' : '#E0F2FE';
        ctx.beginPath();
        ctx.moveTo(baseX, ny - 9);
        ctx.lineTo(tipX, ny + shimmer * 0.25);
        ctx.lineTo(baseX, ny + 9);
        ctx.closePath();
        ctx.fill();
      }
    }

    const warnX = h.x + h.w / 2;
    const warnY = dir === 'down' ? h.y + 68 : dir === 'up' ? 500 : h.y + h.h / 2;
    ctx.save();
    ctx.fillStyle = blink ? '#FFFFFF' : '#7DD3FC';
    ctx.strokeStyle = '#082F49';
    ctx.lineWidth = 3.5;
    ctx.font = 'bold 14px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText('¡HIELO!', warnX, warnY);
    ctx.fillText('¡HIELO!', warnX, warnY);
    ctx.restore();
  } else if (phase.state === 'active') {
    if (isVertical) {
      const startY = dir === 'up' ? h.y + h.h : h.y;
      const endY = dir === 'up' ? h.y : h.y + h.h;

      const cryoGrad = ctx.createLinearGradient(h.x, startY, h.x, endY);
      cryoGrad.addColorStop(0, 'rgba(240, 249, 255, 0.96)');
      cryoGrad.addColorStop(0.22, 'rgba(125, 211, 252, 0.92)');
      cryoGrad.addColorStop(0.68, 'rgba(14, 165, 233, 0.88)');
      cryoGrad.addColorStop(1, 'rgba(186, 230, 253, 0.9)');

      ctx.fillStyle = cryoGrad;
      ctx.beginPath();
      const steps = 16;
      ctx.moveTo(h.x + 2, startY);
      for (let s = 0; s <= steps; s++) {
        const ratio = s / steps;
        const py = startY + (endY - startY) * ratio;
        const wave = Math.sin(time * 18 + ratio * 10) * 4.2;
        ctx.lineTo(h.x + 4 + wave, py);
      }
      for (let s = steps; s >= 0; s--) {
        const ratio = s / steps;
        const py = startY + (endY - startY) * ratio;
        const wave = Math.cos(time * 20 + ratio * 10) * 4.2;
        ctx.lineTo(h.x + h.w - 4 + wave, py);
      }
      ctx.closePath();
      ctx.fill();

      // Vetas cristalinas y núcleos de escarcha dentro de la columna
      const jetCount = Math.max(3, Math.floor(h.w / 28));
      for (let j = 0; j < jetCount; j++) {
        const jx = h.x + (j + 0.5) * (h.w / jetCount);
        const jetW = (h.w / jetCount) * 0.48;
        ctx.fillStyle = 'rgba(224, 242, 254, 0.72)';
        ctx.beginPath();
        ctx.moveTo(jx - jetW * 0.55, startY);
        for (let s = 1; s <= 10; s++) {
          const ratio = s / 10;
          const py = startY + (endY - startY) * ratio;
          const sw = Math.sin(time * 20 + ratio * 12 + j * 1.7) * 4;
          ctx.lineTo(jx + sw - jetW * 0.35, py);
        }
        for (let s = 10; s >= 1; s--) {
          const ratio = s / 10;
          const py = startY + (endY - startY) * ratio;
          const sw = Math.sin(time * 20 + ratio * 12 + j * 1.7) * 4;
          ctx.lineTo(jx + sw + jetW * 0.35, py);
        }
        ctx.closePath();
        ctx.fill();

        // Cristales romboidales viajando por el chorro
        for (let k = 0; k < 4; k++) {
          const prog = ((time * 1.8 + k * 0.25 + j * 0.17) % 1);
          const cy = startY + (endY - startY) * prog;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.beginPath();
          ctx.moveTo(jx, cy - 8);
          ctx.lineTo(jx + 5, cy);
          ctx.lineTo(jx, cy + 8);
          ctx.lineTo(jx - 5, cy);
          ctx.closePath();
          ctx.fill();
        }
      }

      if (dir === 'down') {
        for (let f = 0; f < 5; f++) {
          const fx = h.x + (f + 0.5) * (h.w / 5);
          const r = 12 + Math.sin(time * 18 + f) * 3;
          ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
          ctx.beginPath();
          ctx.ellipse(fx, h.y + h.h - 4, r, 6.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      const startX = dir === 'right' ? h.x : h.x + h.w;
      const endX = dir === 'right' ? h.x + h.w : h.x;

      const hGrad = ctx.createLinearGradient(startX, h.y, endX, h.y);
      hGrad.addColorStop(0, 'rgba(240, 249, 255, 0.96)');
      hGrad.addColorStop(0.24, 'rgba(125, 211, 252, 0.9)');
      hGrad.addColorStop(0.7, 'rgba(14, 165, 233, 0.86)');
      hGrad.addColorStop(1, 'rgba(186, 230, 253, 0.9)');

      ctx.fillStyle = hGrad;
      ctx.beginPath();
      const steps = 14;
      ctx.moveTo(startX, h.y + 4);
      for (let s = 0; s <= steps; s++) {
        const ratio = s / steps;
        const px = startX + (endX - startX) * ratio;
        const wave = Math.sin(time * 18 + ratio * 10) * 5;
        ctx.lineTo(px, h.y + 4 + wave);
      }
      for (let s = steps; s >= 0; s--) {
        const ratio = s / steps;
        const px = startX + (endX - startX) * ratio;
        const wave = Math.cos(time * 20 + ratio * 10) * 5;
        ctx.lineTo(px, h.y + h.h - 4 + wave);
      }
      ctx.closePath();
      ctx.fill();

      const jetCount = Math.max(4, Math.floor(h.h / 58));
      for (let j = 0; j < jetCount; j++) {
        const jy = h.y + (j + 0.5) * (h.h / jetCount);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.fillRect(Math.min(startX, endX) + 6, jy - 3.5, Math.abs(endX - startX) - 12, 7);
      }
    }
  }

  // Boquilla criogénica industrial (azul hielo y acero)
  if (dir === 'up') {
    const baseY = h.y + h.h - 14;
    const metalG = ctx.createLinearGradient(h.x, baseY, h.x, baseY + 16);
    metalG.addColorStop(0, '#94A3B8');
    metalG.addColorStop(1, '#1E293B');
    ctx.fillStyle = metalG;
    ctx.strokeStyle = '#082F49';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(h.x - 6, baseY, h.w + 12, 16, 4);
    ctx.fill();
    ctx.stroke();

    const nozzles = Math.max(3, Math.floor(h.w / 26));
    for (let i = 0; i < nozzles; i++) {
      const nx = h.x + (i + 0.5) * (h.w / nozzles);
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(nx - 6, baseY - 6, 12, 8);
      ctx.strokeRect(nx - 6, baseY - 6, 12, 8);
      ctx.fillStyle = phase.state === 'idle' ? '#7DD3FC' : '#FFFFFF';
      ctx.fillRect(nx - 3, baseY - 8, 6, 3);
    }

    ctx.fillStyle = ledColor;
    ctx.beginPath();
    ctx.arc(h.x + h.w / 2, baseY + 8, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (dir === 'down') {
    const topY = h.y - 6;
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#082F49';
    ctx.lineWidth = 2.5;
    ctx.fillRect(h.x + 14, -10, 12, topY + 14);
    ctx.strokeRect(h.x + 14, -10, 12, topY + 14);
    ctx.fillRect(h.x + h.w - 26, -10, 12, topY + 14);
    ctx.strokeRect(h.x + h.w - 26, -10, 12, topY + 14);

    const metalG = ctx.createLinearGradient(h.x, topY, h.x, topY + 18);
    metalG.addColorStop(0, '#1E293B');
    metalG.addColorStop(1, '#94A3B8');
    ctx.fillStyle = metalG;
    ctx.beginPath();
    ctx.roundRect(h.x - 6, topY, h.w + 12, 18, 4);
    ctx.fill();
    ctx.stroke();

    const nozzles = Math.max(3, Math.floor(h.w / 26));
    for (let i = 0; i < nozzles; i++) {
      const nx = h.x + (i + 0.5) * (h.w / nozzles);
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(nx - 6, topY + 16, 12, 8);
      ctx.strokeRect(nx - 6, topY + 16, 12, 8);
      ctx.fillStyle = phase.state === 'idle' ? '#7DD3FC' : '#FFFFFF';
      ctx.fillRect(nx - 3, topY + 23, 6, 3);
    }

    ctx.fillStyle = ledColor;
    ctx.beginPath();
    ctx.arc(h.x + h.w / 2, topY + 9, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const colX = dir === 'right' ? h.x - 16 : h.x + h.w - 2;
    const colG = ctx.createLinearGradient(colX, h.y, colX + 18, h.y);
    colG.addColorStop(0, '#475569');
    colG.addColorStop(0.5, '#94A3B8');
    colG.addColorStop(1, '#1E293B');
    ctx.fillStyle = colG;
    ctx.strokeStyle = '#082F49';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(colX, h.y - 10, 18, 604 - (h.y - 10), 4);
    ctx.fill();
    ctx.stroke();

    const nozzles = Math.max(4, Math.floor(h.h / 58));
    for (let i = 0; i < nozzles; i++) {
      const ny = h.y + (i + 0.5) * (h.h / nozzles);
      const nx = dir === 'right' ? colX + 16 : colX - 8;
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(nx, ny - 7, 10, 14);
      ctx.strokeRect(nx, ny - 7, 10, 14);
    }

    ctx.fillStyle = ledColor;
    ctx.beginPath();
    ctx.arc(colX + 9, h.y + 8, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawUpdraftVentTrap(
  ctx: CanvasRenderingContext2D,
  h: HazardZone,
  time: number
): void {
  const phase = getPulsingTrapPhase(h, time);
  const blink = Math.sin(time * 20) > 0;
  const cx = h.x + h.w / 2;
  const bottomY = h.y + h.h;

  ctx.save();

  // 1. Corriente de aire ascendente (detrás de la rejilla)
  if (phase.state === 'warning') {
    ctx.save();
    ctx.strokeStyle = `rgba(250, 204, 21, ${0.22 + phase.progress * 0.3})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = time * 55;
    ctx.strokeRect(h.x + 6, h.y + 8, h.w - 12, h.h - 14);
    ctx.restore();

    ctx.fillStyle = blink ? '#FFE600' : '#7DD3FC';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3.5;
    ctx.font = 'bold 13px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText('¡AIRE ▲!', cx, bottomY - 48);
    ctx.fillText('¡AIRE ▲!', cx, bottomY - 48);
  } else if (phase.state === 'active') {
    const colGrad = ctx.createLinearGradient(h.x, bottomY, h.x, h.y);
    colGrad.addColorStop(0, 'rgba(125, 211, 252, 0.42)');
    colGrad.addColorStop(0.55, 'rgba(186, 230, 253, 0.24)');
    colGrad.addColorStop(1, 'rgba(224, 242, 254, 0.03)');
    ctx.fillStyle = colGrad;
    ctx.fillRect(h.x + 4, h.y, h.w - 8, h.h);

    // Ráfagas verticales y flechas ascendentes
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const lx = h.x + 12 + ((i + 0.5) / 6) * (h.w - 24);
      const speed = 520 + (i % 3) * 70;
      const offset = (time * speed + i * 75) % Math.max(80, h.h);
      const y1 = bottomY - offset;
      const y2 = Math.max(h.y, y1 - 54);
      const alpha = Math.max(0, Math.min(0.85, (y1 - h.y) / h.h));
      ctx.strokeStyle =
        i % 2 === 0
          ? `rgba(255, 255, 255, ${alpha})`
          : `rgba(125, 211, 252, ${alpha})`;
      ctx.lineWidth = i % 2 === 0 ? 2.6 : 1.9;
      ctx.beginPath();
      ctx.moveTo(lx + Math.sin(time * 9 + i) * 3, y1);
      ctx.lineTo(lx - Math.sin(time * 9 + i) * 3, y2);
      ctx.stroke();
    }

    // Chevrons ascendentes ▲
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.78)';
    ctx.lineWidth = 2.6;
    for (let c = 0; c < 4; c++) {
      const prog = ((time * 1.9 + c * 0.25) % 1);
      const cy = bottomY - 20 - prog * (h.h - 40);
      ctx.globalAlpha = Math.sin(prog * Math.PI) * 0.85;
      ctx.beginPath();
      ctx.moveTo(cx - 18, cy + 8);
      ctx.lineTo(cx, cy - 4);
      ctx.lineTo(cx + 18, cy + 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // 2. Pozo ventilador subterráneo con rejilla y turbina giratoria
  const pitTop = bottomY - 12;
  ctx.fillStyle = '#0B1120';
  ctx.fillRect(h.x - 4, pitTop, h.w + 8, 28);

  // Aspas de la turbina girando debajo de la rejilla
  const spinSpeed =
    phase.state === 'active' ? 18 : phase.state === 'warning' ? 7 : 1.5;
  const bladeSpan = Math.abs(Math.sin(time * spinSpeed)) * (h.w * 0.38);
  ctx.fillStyle = phase.state === 'active' ? '#38BDF8' : '#64748B';
  ctx.fillRect(cx - bladeSpan, pitTop + 7, bladeSpan * 2, 7);
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(cx - 4, pitTop + 6, 8, 9);

  // Marco industrial y barras de rejilla
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#090D16';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(h.x - 6, pitTop - 2, h.w + 12, 16, 4);
  ctx.stroke();

  const bars = Math.max(4, Math.floor(h.w / 18));
  for (let i = 0; i <= bars; i++) {
    const bx = h.x + (i / bars) * h.w;
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(bx - 2, pitTop - 2, 4, 15);
  }

  // Topes laterales amarillo/negro de precaución
  for (const sx of [h.x - 10, h.x + h.w + 2]) {
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(sx, pitTop - 5, 8, 18);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(sx, pitTop + 1, 8, 6);
    ctx.strokeRect(sx, pitTop - 5, 8, 18);
  }

  const ledColor =
    phase.state === 'active'
      ? '#38BDF8'
      : phase.state === 'warning'
        ? blink
          ? '#FACC15'
          : '#0EA5E9'
        : '#22C55E';
  ctx.fillStyle = ledColor;
  ctx.beginPath();
  ctx.arc(cx, pitTop + 6, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSuctionPitTrap(
  ctx: CanvasRenderingContext2D,
  h: HazardZone,
  time: number
): void {
  const phase = getPulsingTrapPhase(h, time);
  const blink = Math.sin(time * 20) > 0;
  const cx = h.x + h.w / 2;
  const pitTop = 600;

  ctx.save();

  // 1. Fosa profunda del succionador
  const pitGrad = ctx.createLinearGradient(h.x, pitTop, h.x, 720);
  pitGrad.addColorStop(0, '#0F172A');
  pitGrad.addColorStop(0.55, '#1E1B4B');
  pitGrad.addColorStop(1, '#090514');
  ctx.fillStyle = pitGrad;
  ctx.fillRect(h.x, pitTop, h.w, 120);

  // Paredes laterales reforzadas del pozo
  ctx.fillStyle = '#334155';
  ctx.fillRect(h.x, pitTop, 7, 120);
  ctx.fillRect(h.x + h.w - 7, pitTop, 7, 120);

  // Turbina de succión al fondo del pozo
  const spinSpeed =
    phase.state === 'active' ? 22 : phase.state === 'warning' ? 8 : 1.8;
  const bladeSpan = Math.abs(Math.cos(time * spinSpeed)) * (h.w * 0.4);
  ctx.fillStyle = phase.state === 'active' ? '#A855F7' : '#475569';
  ctx.fillRect(cx - bladeSpan, 668, bladeSpan * 2, 12);
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(cx - 5, 665, 10, 18);

  // 2. Efecto visual de flujo según ciclo
  if (phase.state === 'idle') {
    // Ventana segura para saltar
    ctx.fillStyle = 'rgba(34, 197, 94, 0.85)';
    ctx.font = 'bold 11px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SALTA', cx, pitTop + 26);
  } else if (phase.state === 'warning') {
    ctx.strokeStyle = `rgba(192, 132, 252, ${0.28 + phase.progress * 0.35})`;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([7, 7]);
    ctx.lineDashOffset = -time * 50;
    ctx.strokeRect(h.x + 6, pitTop - 90, h.w - 12, 120);
    ctx.setLineDash([]);

    ctx.fillStyle = blink ? '#F0ABFC' : '#C084FC';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3.5;
    ctx.font = 'bold 13px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText('¡SUCCIÓN ▼!', cx, pitTop - 22);
    ctx.fillText('¡SUCCIÓN ▼!', cx, pitTop - 22);
  } else if (phase.state === 'active') {
    // Embudo de aire descendente desde arriba hasta la boca del pozo
    const vortexGrad = ctx.createLinearGradient(cx, h.y, cx, pitTop + 80);
    vortexGrad.addColorStop(0, 'rgba(168, 85, 247, 0.02)');
    vortexGrad.addColorStop(0.55, 'rgba(192, 132, 252, 0.24)');
    vortexGrad.addColorStop(1, 'rgba(126, 34, 206, 0.56)');
    ctx.fillStyle = vortexGrad;
    ctx.beginPath();
    ctx.moveTo(h.x - 10, h.y);
    ctx.lineTo(h.x + h.w + 10, h.y);
    ctx.lineTo(h.x + h.w - 8, pitTop + 80);
    ctx.lineTo(h.x + 8, pitTop + 80);
    ctx.closePath();
    ctx.fill();

    // Líneas de corriente convergiendo hacia abajo
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const topX = h.x + 10 + ((i + 0.5) / 7) * (h.w - 20);
      const prog = ((time * 2.2 + i * 0.19) % 1);
      const y1 = h.y + prog * (pitTop + 55 - h.y);
      const y2 = Math.min(pitTop + 65, y1 + 52);
      const ratio1 = (y1 - h.y) / (pitTop + 65 - h.y);
      const ratio2 = (y2 - h.y) / (pitTop + 65 - h.y);
      const x1 = topX + (cx - topX) * ratio1 * 0.45;
      const x2 = topX + (cx - topX) * ratio2 * 0.45;

      ctx.strokeStyle =
        i % 2 === 0 ? 'rgba(232, 121, 249, 0.72)' : 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = i % 2 === 0 ? 2.6 : 1.8;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Chevrons descendentes ▼
    ctx.strokeStyle = 'rgba(240, 171, 252, 0.85)';
    ctx.lineWidth = 2.6;
    for (let c = 0; c < 4; c++) {
      const prog = ((time * 2.1 + c * 0.25) % 1);
      const cy = h.y + 40 + prog * (pitTop + 20 - h.y);
      ctx.globalAlpha = Math.sin(prog * Math.PI) * 0.9;
      ctx.beginPath();
      ctx.moveTo(cx - 18, cy - 6);
      ctx.lineTo(cx, cy + 6);
      ctx.lineTo(cx + 18, cy - 6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Luces LED en los bordes del pozo
  const ledColor =
    phase.state === 'active'
      ? '#C084FC'
      : phase.state === 'warning'
        ? blink
          ? '#FACC15'
          : '#A855F7'
        : '#22C55E';
  ctx.fillStyle = ledColor;
  ctx.beginPath();
  ctx.arc(h.x + 12, pitTop + 10, 4, 0, Math.PI * 2);
  ctx.arc(h.x + h.w - 12, pitTop + 10, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/* ============================================================================
 *  TIZA, META CON CARTEL FRENAR®, BIDÓN Y REPUESTOS REALISTAS
 * ========================================================================== */

function drawChalkConstruct(
  ctx: CanvasRenderingContext2D,
  ch: ChalkConstruct,
  time: number
): void {
  const alpha = Math.min(1, ch.timer / 0.8);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ch.kind === 'bridge' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(244, 63, 94, 0.25)';
  ctx.strokeStyle = ch.color;
  ctx.lineWidth = 3.5;
  ctx.setLineDash([10, 5]);
  ctx.lineDashOffset = -time * 28;
  ctx.beginPath();
  ctx.roundRect(ch.x, ch.y, ch.w, ch.h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawLevelGoal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unlocked: boolean,
  isWorkshop: boolean,
  time: number
): void {
  ctx.save();

  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = '#090D16';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x - 66, y - 6, 132, 134, 12);
  ctx.fill();
  ctx.stroke();

  if (isWorkshop) {
    // Rótulo oficial del taller FRENAR® sobre la fachada de entrada
    ctx.fillStyle = '#0B1120';
    ctx.strokeStyle = '#FFE600';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x - 74, y - 34, 148, 40, 8);
    ctx.fill();
    ctx.stroke();
    drawFrenarLogo(ctx, x, y - 14, 0.52);
  } else {
    ctx.fillStyle = unlocked ? '#FFE600' : '#475569';
    ctx.fillRect(x - 52, y + 4, 104, 24);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 14px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SALIDA', x, y + 21);
  }

  if (unlocked) {
    const pGrad = ctx.createRadialGradient(x, y + 80, 8, x, y + 80, 48);
    pGrad.addColorStop(0, '#FFFFFF');
    pGrad.addColorStop(0.45, '#00E5FF');
    pGrad.addColorStop(1, '#2563EB');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.roundRect(x - 42, y + 36, 84, 90, 8);
    ctx.fill();

    ctx.strokeStyle = '#FFE600';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y + 80, 23 + Math.sin(time * 5) * 3, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(x - 42, y + 36, 84, 90, 8);
    ctx.fill();
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FALTAN', x, y + 76);
    ctx.fillText('REPUESTOS', x, y + 92);
  }

  ctx.restore();
}

function drawFluidBottle(
  ctx: CanvasRenderingContext2D,
  b: FluidBottle,
  time: number
): void {
  const by = b.y + Math.sin(time * 4.2 + b.bobPhase) * 5;
  ctx.save();
  ctx.translate(b.x, by);

  // Halo cálido ámbar
  const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 22);
  halo.addColorStop(0, 'rgba(255, 190, 20, 0.36)');
  halo.addColorStop(1, 'rgba(255, 190, 20, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();

  // Bidón automotriz de líquido de freno DOT con asa lateral
  ctx.fillStyle = '#E2E8F0';
  ctx.strokeStyle = '#110B1E';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-11, -9);
  ctx.lineTo(3, -13);
  ctx.lineTo(11, -5);
  ctx.lineTo(11, 14);
  ctx.lineTo(-11, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Ventana translúcida con líquido ámbar DOT-4
  const liqGrad = ctx.createLinearGradient(0, -3, 0, 12);
  liqGrad.addColorStop(0, '#FACC15');
  liqGrad.addColorStop(1, '#EA580C');
  ctx.fillStyle = liqGrad;
  ctx.beginPath();
  ctx.roundRect(-8, -2, 14, 13, 2.5);
  ctx.fill();

  // Asa del bidón
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(5, -4, 3.5, 8);

  // Tapón rojo roscado
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.roundRect(-9, -18, 9, 6, 1.5);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawHeartPickup(
  ctx: CanvasRenderingContext2D,
  heart: HeartPickup,
  time: number
): void {
  const hy = heart.y + Math.sin(time * 4.5 + heart.bobPhase) * 6;
  const pulse = 1 + Math.sin(time * 6 + heart.bobPhase) * 0.08;

  ctx.save();
  ctx.translate(heart.x, hy);
  ctx.scale(pulse, pulse);

  const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
  halo.addColorStop(0, 'rgba(255, 45, 135, 0.55)');
  halo.addColorStop(0.55, 'rgba(239, 68, 68, 0.25)');
  halo.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();

  const hGrad = ctx.createLinearGradient(-14, -14, 14, 16);
  hGrad.addColorStop(0, '#FF7EB6');
  hGrad.addColorStop(0.45, '#FF1E56');
  hGrad.addColorStop(1, '#991B1B');

  ctx.fillStyle = hGrad;
  ctx.strokeStyle = '#110B1E';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(0, 14);
  ctx.bezierCurveTo(-18, 3, -18, -14, -7, -14);
  ctx.bezierCurveTo(-2, -14, 0, -9, 0, -6);
  ctx.bezierCurveTo(0, -9, 2, -14, 7, -14);
  ctx.bezierCurveTo(18, -14, 18, 3, 0, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Brillo especular superior
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.ellipse(-6, -7, 3.6, 2, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Estrellita orbitando
  const sx = Math.cos(time * 3.5 + heart.bobPhase) * 20;
  const sy = Math.sin(time * 3.5 + heart.bobPhase) * 14 - 4;
  ctx.fillStyle = '#FFE600';
  ctx.beginPath();
  ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBrakePart(
  ctx: CanvasRenderingContext2D,
  pt: BrakePart,
  time: number
): void {
  const py = pt.y + Math.sin(time * 3.4 + pt.bobPhase) * 6;
  ctx.save();
  ctx.translate(pt.x, py);

  const halo = ctx.createRadialGradient(0, 0, 6, 0, 0, 32);
  halo.addColorStop(0, 'rgba(0, 229, 255, 0.52)');
  halo.addColorStop(1, 'rgba(0, 229, 255, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.fill();

  drawPartIcon(ctx, pt.partType);

  ctx.fillStyle = '#FFE600';
  ctx.strokeStyle = '#110B1E';
  ctx.lineWidth = 3.2;
  ctx.font = 'bold 11.5px "Fredoka", sans-serif';
  ctx.textAlign = 'center';
  ctx.strokeText(pt.label, 0, 31);
  ctx.fillText(pt.label, 0, 31);

  ctx.restore();
}

function drawPartIcon(ctx: CanvasRenderingContext2D, type: BrakePartType): void {
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.3;

  switch (type) {
    case 'disc': {
      // Disco de freno ventilado y ranurado con maza y 5 pernos
      const rotorG = ctx.createRadialGradient(-5, -5, 4, 0, 0, 19);
      rotorG.addColorStop(0, '#F8FAFC');
      rotorG.addColorStop(0.65, '#CBD5E1');
      rotorG.addColorStop(1, '#64748B');
      ctx.fillStyle = rotorG;
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Ranuras de ventilación
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 11, Math.sin(a) * 11);
        ctx.lineTo(Math.cos(a + 0.3) * 17, Math.sin(a + 0.3) * 17);
        ctx.stroke();
      }

      // Maza central oscura + 5 agujeros de bulones
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#94A3B8';
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 5.2, Math.sin(a) * 5.2, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'pad': {
      // Pastilla de freno en arco (zapata metálica con orejas + compuesto de fricción con ranura)
      ctx.fillStyle = '#94A3B8'; // placa de respaldo metálica
      ctx.beginPath();
      ctx.arc(0, 14, 23, -Math.PI * 0.78, -Math.PI * 0.22);
      ctx.lineTo(18, -3);
      ctx.arc(0, 14, 15, -Math.PI * 0.25, -Math.PI * 0.75, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Orejas de montaje laterales
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(-19, -5, 5, 6);
      ctx.strokeRect(-19, -5, 5, 6);
      ctx.fillRect(14, -5, 5, 6);
      ctx.strokeRect(14, -5, 5, 6);

      // Material de fricción cobrizo/grafito con ranura central
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, 14, 21, -Math.PI * 0.72, -Math.PI * 0.28);
      ctx.arc(0, 14, 11, -Math.PI * 0.28, -Math.PI * 0.72, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(0, 3);
      ctx.stroke();
      break;
    }

    case 'pump': {
      // Bomba hidráulica / cilindro maestro con depósito translúcido y racores
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.roundRect(-16, -2, 32, 13, 4);
      ctx.fill();
      ctx.stroke();

      // Brida de fijación izquierda
      ctx.fillStyle = '#64748B';
      ctx.fillRect(-19, -6, 5, 20);
      ctx.strokeRect(-19, -6, 5, 20);

      // Depósito superior de fluido con tapa amarilla
      ctx.fillStyle = '#FEF3C7';
      ctx.beginPath();
      ctx.roundRect(-7, -15, 16, 13, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(-5, -10, 12, 7);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-4, -18, 10, 4);

      // Racores de cañería de freno
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(2, 11, 4, 4);
      ctx.fillRect(9, 11, 4, 4);
      break;
    }

    case 'drum': {
      // Campana de freno acanalada de hierro fundido
      ctx.fillStyle = '#64748B';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Aletas radiales de disipación
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 13.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'caliper': {
      // Mordaza / Caliper rojo abrazando un sector de disco metálico
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.arc(-3, 2, 15, -Math.PI * 0.4, Math.PI * 0.9);
      ctx.lineTo(-3, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cuerpo de mordaza rojo deportivo
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.arc(2, 0, 16, -Math.PI * 0.72, Math.PI * 0.62);
      ctx.lineTo(1, 5);
      ctx.lineTo(1, -5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Pistones y purga
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.arc(9, -6, 3, 0, Math.PI * 2);
      ctx.arc(9, 6, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(3, -17, 4, 4);
      break;
    }
  }
}

/* ============================================================================
 *  ANATOMÍA ARTICULADA + EXPRESIONES VISIBLES + 6 ANIMACIONES IDLE ÚNICAS
 * ========================================================================== */

function drawLimbSegment(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r1: number,
  r2: number,
  fill: string | CanvasGradient,
  outline = '#120C1C'
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * r1, y1 + ny * r1);
  ctx.lineTo(x2 + nx * r2, y2 + ny * r2);
  ctx.arc(x2, y2, r2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
  ctx.lineTo(x1 - nx * r1, y1 - ny * r1);
  ctx.arc(x1, y1, r1, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawShoe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  soleColor: string,
  isConverse = false
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = '#120C1C';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-5, -6);
  ctx.lineTo(4, -6);
  ctx.quadraticCurveTo(11, -5, 11, -1);
  ctx.lineTo(-6, -1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = soleColor;
  ctx.fillRect(-6, -2.5, 17, 2.5);
  if (isConverse) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(8.5, -2.5, 2.8, -Math.PI * 0.5, Math.PI * 0.1);
    ctx.fill();
  }
  ctx.restore();
}

export interface CharacterSpriteOptions {
  cx: number;
  bottomY: number;
  facing: 1 | -1;
  walkCycle: number;
  isMoving: boolean;
  onGround: boolean;
  vy: number;
  time: number;
  powerActive: boolean;
  isCrouching?: boolean;
  isSleepingInBed?: boolean;
  isIdleScene?: boolean;
  idleTime?: number;
  idleClientChar?: CharacterId;
  expression?: CharacterExpression;
  scale?: number;
}

export function drawCharacterSprite(
  ctx: CanvasRenderingContext2D,
  id: CharacterId,
  opts: CharacterSpriteOptions
): void {
  const s = opts.scale ?? 1;
  ctx.save();
  ctx.translate(opts.cx, opts.bottomY);
  ctx.scale(s, s);

  if (opts.isIdleScene || (opts.isSleepingInBed && id === 'micaela')) {
    drawCharacterIdleScene(ctx, id, opts);
    ctx.restore();
    return;
  }

  if (id === 'micaela' && opts.powerActive) {
    drawMicaelaCloud(ctx, opts.time);
  }

  ctx.scale(opts.facing, 1);

  const crouch = !!opts.isCrouching;
  const phase = opts.walkCycle * 6.5;
  const stride = opts.isMoving ? Math.sin(phase) : 0;
  const lift = opts.isMoving ? Math.max(0, Math.cos(phase)) : 0;

  const skin = id === 'leandro' ? '#E9B996' : id === 'rodolfo' ? '#EEC09D' : '#F4CBB0';
  const skinShadow = id === 'leandro' ? '#C98E68' : '#D39A76';

  const hipY = crouch ? -17 : -31;
  const torsoTopY = crouch ? -35 : -51;
  const headY = crouch ? -45 : -63;
  const bob = opts.isMoving && !crouch ? Math.abs(Math.sin(phase)) * 2.5 : Math.sin(opts.time * 3) * 0.8;

  const pantsColor =
    id === 'rodolfo'
      ? '#1A1D26'
      : id === 'marcela'
        ? '#1E293B'
        : id === 'micaela'
          ? skin
          : id === 'lautaro'
            ? '#171923'
            : id === 'leandro'
              ? '#1F2937'
              : '#3B6EA5';

  const shoeColor =
    id === 'micaela'
      ? '#111827'
      : id === 'leandro'
        ? '#F8FAFC'
        : id === 'marcela'
          ? '#334155'
          : '#1E293B';

  const drawLeg = (isBack: boolean) => {
    const dir = isBack ? -1 : 1;
    const legSwing = opts.onGround ? stride * 12 * dir : isBack ? -7 : 8;
    const kneeBend = crouch ? 11 : opts.onGround ? lift * 5 * (isBack ? 0.5 : 1) : 6;
    const hipX = isBack ? -2 : 2;
    const kneeX = hipX + legSwing * 0.55 + (crouch ? 8 : 3);
    const kneeY = hipY + (crouch ? 7 : 13) - kneeBend * 0.4;
    const ankleX = hipX + legSwing;
    const ankleY = -3 - (opts.onGround ? Math.max(0, -stride * dir) * 4 : 3);

    drawLimbSegment(ctx, hipX, hipY - bob, kneeX, kneeY, 4.6, 3.8, pantsColor);
    const calfColor = id === 'rodolfo' ? skin : pantsColor;
    drawLimbSegment(ctx, kneeX, kneeY, ankleX, ankleY, 3.7, 2.8, calfColor);
    drawShoe(ctx, ankleX, ankleY + 3, shoeColor, '#E2E8F0', id === 'micaela');
  };

  drawLeg(true);

  if (id === 'rodolfo') {
    ctx.fillStyle = '#1D4ED8';
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-15, torsoTopY + 3 - bob, 11, 20, 4);
    ctx.fill();
    ctx.stroke();

    if (!opts.powerActive) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-10, torsoTopY + 1 - bob, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.ellipse(-13, torsoTopY - 3 - bob, 2.2, 4, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#110B1E';
      ctx.beginPath();
      ctx.arc(-8, torsoTopY - bob, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (id === 'gustavo' && !opts.powerActive) {
    ctx.save();
    ctx.translate(-8, torsoTopY + 12 - bob);
    ctx.rotate(-0.45);
    ctx.fillStyle = '#7C3AED';
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 4, 7, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#92400E';
    ctx.fillRect(-1.8, -18, 3.6, 16);
    ctx.restore();
  }

  const armSwing = opts.onGround ? -stride * 10 : -8;
  const shoulderY = torsoTopY + 4 - bob;
  drawLimbSegment(
    ctx,
    -2,
    shoulderY,
    -4 + armSwing * 0.4,
    shoulderY + 11,
    3.6,
    2.9,
    id === 'marcela' ? '#F8FAFC' : skinShadow
  );
  drawLimbSegment(
    ctx,
    -4 + armSwing * 0.4,
    shoulderY + 11,
    -1 + armSwing,
    shoulderY + 20,
    2.8,
    2.4,
    skinShadow
  );

  drawLeg(false);

  // Torso sombreado
  const shirtGrad = ctx.createLinearGradient(-9, torsoTopY - bob, 9, hipY - bob);
  if (id === 'marcela') {
    shirtGrad.addColorStop(0, '#FFFFFF');
    shirtGrad.addColorStop(1, '#CBD5E1');
  } else if (id === 'leandro') {
    shirtGrad.addColorStop(0, '#5B7C99');
    shirtGrad.addColorStop(1, '#334E68');
  } else {
    shirtGrad.addColorStop(0, '#272935');
    shirtGrad.addColorStop(1, '#12131A');
  }

  ctx.fillStyle = shirtGrad;
  ctx.strokeStyle = '#120C1C';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-7, torsoTopY - bob);
  ctx.lineTo(8, torsoTopY - bob);
  ctx.quadraticCurveTo(10, (torsoTopY + hipY) * 0.5 - bob, 7.5, hipY + 2 - bob);
  ctx.lineTo(-7.5, hipY + 2 - bob);
  ctx.quadraticCurveTo(-9, (torsoTopY + hipY) * 0.5 - bob, -7, torsoTopY - bob);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (id === 'marcela') {
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.roundRect(-8, hipY - 2 - bob, 16, 15, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FF2D87';
    ctx.fillRect(2, hipY + 1 - bob, 2.5, 6);
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(5, hipY + 2 - bob, 2.5, 5);
  } else if (id === 'micaela') {
    ctx.fillStyle = '#1B5E3F';
    ctx.beginPath();
    ctx.moveTo(-8, hipY - 1 - bob);
    ctx.lineTo(8, hipY - 1 - bob);
    ctx.lineTo(12, hipY + 11 - bob);
    ctx.lineTo(-11, hipY + 11 - bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.fillRect(-5, hipY - 1 - bob, 3, 12);
    ctx.fillRect(2, hipY - 1 - bob, 3, 12);
  } else if (id === 'leandro') {
    ctx.fillStyle = '#10B981';
    ctx.fillRect(-4, torsoTopY + 7 - bob, 11, 7);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(1, torsoTopY + 1 - bob, 4.5, 0.15, Math.PI - 0.15);
    ctx.stroke();
  } else if (id === 'gustavo') {
    ctx.fillStyle = '#10B981';
    ctx.fillRect(-1, torsoTopY + 9 - bob, 2, 7);
    ctx.beginPath();
    ctx.arc(0, torsoTopY + 9 - bob, 3.5, Math.PI, 0);
    ctx.fill();
  }

  // Cuello y cabeza más amplia y expresiva
  ctx.fillStyle = skinShadow;
  ctx.fillRect(-3, torsoTopY - 4 - bob, 6, 6);

  const hGrad = ctx.createRadialGradient(2, headY - 3 - bob, 2, 0, headY - bob, 14);
  hGrad.addColorStop(0, skin);
  hGrad.addColorStop(1, skinShadow);
  ctx.fillStyle = hGrad;
  ctx.strokeStyle = '#120C1C';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0.5, headY - bob, 11.8, 12.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Oreja visible
  ctx.fillStyle = skinShadow;
  ctx.beginPath();
  ctx.arc(-9.5, headY + 1 - bob, 2.8, 0, Math.PI * 2);
  ctx.fill();

  const expr: CharacterExpression =
    opts.expression ??
    (opts.powerActive
      ? 'power'
      : crouch
        ? 'crouch'
        : !opts.onGround && opts.vy < -60
          ? 'jump'
          : !opts.onGround && opts.vy > 140
            ? 'fall'
            : 'normal');

  drawCharacterHeadDetails(ctx, id, headY - bob, expr, opts.time);

  // Brazo delantero
  const fSwing = opts.onGround ? stride * 10 : 9;
  const shX = 1.5;
  const elbowX = shX + fSwing * 0.45 + 2;
  const elbowY = shoulderY + 10;
  const handX = opts.powerActive && id === 'gustavo' ? 13 : shX + fSwing + 3;
  const handY = opts.powerActive && id === 'gustavo' ? shoulderY + 11 : shoulderY + 19;

  const sleeveColor =
    id === 'marcela'
      ? '#FFFFFF'
      : id === 'leandro'
        ? '#5B7C99'
        : '#1E202B';
  drawLimbSegment(ctx, shX, shoulderY, elbowX, elbowY, 3.8, 3.1, sleeveColor);
  drawLimbSegment(
    ctx,
    elbowX,
    elbowY,
    handX,
    handY,
    3,
    2.4,
    id === 'marcela' ? '#F1F5F9' : skin
  );

  if (id === 'rodolfo') {
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(handX - 2.5, handY - 3, 5, 3);
  }

  if (id === 'gustavo' && opts.powerActive) {
    ctx.save();
    ctx.translate(10, torsoTopY + 14 - bob);
    ctx.rotate(0.18);
    ctx.fillStyle = '#A855F7';
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 9, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FDE047';
    ctx.fillRect(5, -1.8, 16, 3.6);
    ctx.restore();
  }

  if (id === 'leandro' && opts.powerActive) {
    for (let i = 0; i < 3; i++) {
      const ang = opts.time * 18 + (i * Math.PI * 2) / 3;
      const sx = Math.cos(ang) * 28;
      const sy = (torsoTopY + hipY) * 0.5 + Math.sin(ang) * 24;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang + 1.2);
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-8, -2);
      ctx.lineTo(10, 0);
      ctx.lineTo(-8, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawCharacterHeadDetails(
  ctx: CanvasRenderingContext2D,
  id: CharacterId,
  hy: number,
  expr: CharacterExpression,
  time: number
): void {
  const isBlinking = expr === 'normal' && time % 3.6 > 3.45;

  // Ojos / Anteojos con expresión clara
  if (id === 'marcela') {
    ctx.fillStyle = expr === 'frozen' ? '#0284C7' : '#0F172A';
    ctx.strokeStyle = expr === 'frozen' ? '#BAE6FD' : '#334155';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(0.5, hy - 4, 10.5, 5.8, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillRect(2.2, hy - 3, 3.5, 1.6);
  } else if (expr === 'hurt') {
    // Ojos apretados > <
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(3, hy - 4);
    ctx.lineTo(8, hy - 1.5);
    ctx.lineTo(3, hy + 1);
    ctx.stroke();
  } else if (expr === 'frozen') {
    // Ojos muy abiertos tiritando de frío
    const jitter = Math.sin(time * 52) * 0.6;
    ctx.fillStyle = '#E0F2FE';
    ctx.beginPath();
    ctx.ellipse(5.8, hy - 1.2, 3.6, 4.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(6.6 + jitter, hy - 1.2, 1.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (expr === 'celebrate' || expr === 'idle') {
    // Ojos felices en arco ^ ^
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(5.8, hy - 0.5, 3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else if (isBlinking) {
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(3, hy - 1);
    ctx.lineTo(8.5, hy - 1);
    ctx.stroke();
  } else {
    // Esclerótica blanca + pupila expresiva + brillo
    const eyeH = expr === 'fall' ? 3.8 : expr === 'crouch' ? 2.1 : 3.2;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(5.8, hy - 1.2, 3.2, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#110B1E';
    const lookY = expr === 'jump' ? -0.9 : expr === 'fall' ? 0.8 : 0;
    ctx.beginPath();
    ctx.arc(6.8, hy - 1.2 + lookY, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(7.4, hy - 2 + lookY, 0.7, 0, Math.PI * 2);
    ctx.fill();

    if (id === 'micaela') {
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.3;
      ctx.strokeRect(2.3, hy - 4.6, 7.2, 6);
    }
  }

  // Rubor helado en mejilla cuando está congelado
  if (expr === 'frozen') {
    ctx.fillStyle = 'rgba(125, 211, 252, 0.55)';
    ctx.beginPath();
    ctx.ellipse(2.5, hy + 2.6, 3.2, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cejas dinámicas
  ctx.strokeStyle = id === 'rodolfo' ? '#334155' : '#1E1B24';
  ctx.lineWidth = id === 'rodolfo' ? 2.5 : 1.7;
  ctx.beginPath();
  if (expr === 'power' || expr === 'crouch') {
    ctx.moveTo(2.5, hy - 6.2);
    ctx.lineTo(9.2, hy - 4.2);
  } else if (expr === 'jump' || expr === 'fall' || expr === 'frozen') {
    ctx.moveTo(2.5, hy - 6.6);
    ctx.lineTo(9.0, hy - 6.8);
  } else if (expr === 'hurt') {
    ctx.moveTo(2.5, hy - 4.5);
    ctx.lineTo(9.0, hy - 6.6);
  } else {
    ctx.moveTo(2.5, hy - 5.6);
    ctx.lineTo(9.0, hy - 4.8);
  }
  ctx.stroke();

  // Boca / barba / expresión según estado
  if (expr === 'frozen') {
    // Dientes castañeteando de frío
    const chatter = Math.sin(time * 42) * 0.7;
    ctx.fillStyle = '#38BDF8';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(2.5, hy + 3.2 + chatter * 0.4, 7.2, 3.8, 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(3.2, hy + 3.8 + chatter * 0.4, 5.8, 2.4);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(5.1, hy + 3.8);
    ctx.lineTo(5.1, hy + 6.2);
    ctx.moveTo(7.1, hy + 3.8);
    ctx.lineTo(7.1, hy + 6.2);
    ctx.stroke();
  } else if (expr === 'power' || expr === 'celebrate' || expr === 'jump') {
    ctx.fillStyle = '#7F1D1D';
    ctx.beginPath();
    ctx.ellipse(5.8, hy + 4.8, 3.4, 2.5, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(3.6, hy + 4.2, 4.4, 1.1);
  } else if (expr === 'fall') {
    ctx.fillStyle = '#110B1E';
    ctx.beginPath();
    ctx.arc(5.8, hy + 5.2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (expr === 'hurt') {
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(3, hy + 5.5);
    ctx.quadraticCurveTo(5.5, hy + 3.2, 8.5, hy + 5.5);
    ctx.stroke();
  } else if (id === 'micaela') {
    ctx.fillStyle = '#6B1D4A';
    ctx.fillRect(4, hy + 4.2, 4.6, 2.2);
  } else if (id === 'lautaro') {
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(5.8, hy + 3.8, 3.4, 0.1, Math.PI * 0.8);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(5.6, hy + 4.1, 2.8, 0.15, Math.PI * 0.72);
    ctx.stroke();
  }

  if (id === 'gustavo') {
    ctx.fillStyle = '#27272A';
    ctx.beginPath();
    ctx.arc(2.5, hy + 4.8, 7, 0.15, Math.PI * 0.72);
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(-8.5, hy + 2.5, 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Cabello en capas
  ctx.strokeStyle = '#120C1C';
  ctx.lineWidth = 1.8;
  switch (id) {
    case 'rodolfo': {
      ctx.fillStyle = '#64748B';
      ctx.beginPath();
      ctx.arc(-1, hy - 4.5, 12, Math.PI * 0.9, Math.PI * 2.08);
      ctx.lineTo(11, hy - 9);
      ctx.lineTo(5, hy - 15);
      ctx.lineTo(-4, hy - 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(-3, hy - 12, 5.5, 2.5);
      break;
    }
    case 'marcela': {
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(-1, hy - 2.5, 12.8, Math.PI * 0.68, Math.PI * 2.05);
      ctx.lineTo(-12, hy + 11);
      ctx.quadraticCurveTo(-14, hy + 2, -12, hy - 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'micaela': {
      ctx.fillStyle = '#5C3A21';
      ctx.beginPath();
      ctx.arc(-1, hy - 2.5, 12.8, Math.PI * 0.65, Math.PI * 2.05);
      ctx.lineTo(-11, hy + 16);
      ctx.lineTo(-14, hy + 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'lautaro': {
      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.arc(-1, hy - 4.5, 12, Math.PI * 0.92, Math.PI * 2.1);
      ctx.lineTo(13, hy - 2);
      ctx.lineTo(2, hy - 7.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'leandro': {
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(0, hy - 5.5, 11.5, Math.PI, Math.PI * 2.05);
      ctx.lineTo(11.5, hy - 5.5);
      ctx.lineTo(-7.5, hy - 6.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'gustavo': {
      ctx.fillStyle = '#27272A';
      ctx.beginPath();
      ctx.arc(-1, hy - 4, 12.3, Math.PI * 0.85, Math.PI * 2.05);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-5, hy - 10, 4.5, 2);
      break;
    }
  }
}

/* ============================================================================
 *  6 ESCENAS IDLE ÚNICAS (CON EFECTO POP TRAS ~2s QUIETOS)
 * ========================================================================== */

function drawCharacterIdleScene(
  ctx: CanvasRenderingContext2D,
  id: CharacterId,
  opts: CharacterSpriteOptions
): void {
  const t = opts.time;
  const sinceIdle = Math.max(0.01, (opts.idleTime ?? 2.2) - 2.0);
  const pop = Math.min(1, sinceIdle / 0.22);
  const propScale = pop < 1 ? 0.65 + Math.sin(pop * Math.PI * 0.65) * 0.42 : 1;

  if (id === 'micaela') {
    ctx.save();
    ctx.scale(propScale, propScale);
    drawMicaelaInBed(ctx, t);
    ctx.restore();
    return;
  }

  if (id === 'rodolfo') {
    // Rodolfo se agacha/arrodilla con cariño acariciando a su perro blanco
    drawCharacterSprite(ctx, 'rodolfo', {
      ...opts,
      cx: -14 * opts.facing,
      bottomY: 0,
      isIdleScene: false,
      isCrouching: true,
      expression: 'idle',
      scale: 1,
    });

    ctx.save();
    ctx.scale(propScale, propScale);
    const dogX = 24 * opts.facing;
    drawWhiteDog(ctx, {
      active: true,
      x: dogX,
      y: 0,
      vx: 0,
      facing: (opts.facing * -1) as 1 | -1,
      timer: 1,
      maxTimer: 1,
      attackCooldown: 0,
      lungeTimer: 0,
      animTime: t,
    });
    // Mano acariciando + corazoncitos flotantes
    const petY = -26 + Math.sin(t * 7) * 3;
    ctx.fillStyle = '#EEC09D';
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(dogX - 4 * opts.facing, petY, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FF2D87';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('♥', dogX - 4, -42 - ((t * 16) % 14));
    ctx.restore();
    return;
  }

  if (id === 'marcela') {
    // Pizarrón verde escolar pop + Marcela escribiendo con tiza
    ctx.save();
    ctx.translate(38 * opts.facing, 0);
    ctx.scale(propScale, propScale);
    // Patas de madera
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-26, -8);
    ctx.lineTo(-30, 0);
    ctx.moveTo(26, -8);
    ctx.lineTo(30, 0);
    ctx.stroke();

    // Marco y pizarrón verde
    ctx.fillStyle = '#14532D';
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-34, -76, 68, 52, 4);
    ctx.fill();
    ctx.stroke();

    // Trazos de tiza en el pizarrón
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-24, -62);
    ctx.lineTo(14, -62);
    ctx.moveTo(-24, -50);
    ctx.lineTo(8 + Math.sin(t * 5) * 8, -50);
    ctx.stroke();
    ctx.fillStyle = '#FFE600';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('F = P·A', -24, -34);
    ctx.restore();

    drawCharacterSprite(ctx, 'marcela', {
      ...opts,
      cx: -8 * opts.facing,
      bottomY: 0,
      isIdleScene: false,
      expression: 'idle',
      scale: 1,
    });
    return;
  }

  if (id === 'lautaro') {
    // Renault 19 gris planchado con neones azules + capot abierto + Lautaro arreglando el motor
    ctx.save();
    ctx.translate(36 * opts.facing, 0);
    ctx.scale(propScale, propScale);
    drawRenault19(ctx, 0, 0, opts.facing, t, true);
    ctx.restore();

    drawCharacterSprite(ctx, 'lautaro', {
      ...opts,
      cx: -14 * opts.facing,
      bottomY: 0,
      isIdleScene: false,
      expression: 'crouch',
      scale: 1,
    });
    // Llave inglesa en movimiento sobre el motor
    ctx.save();
    ctx.translate(4 * opts.facing, -40);
    ctx.rotate(Math.sin(t * 9) * 0.4);
    ctx.fillStyle = '#CBD5E1';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.8;
    ctx.fillRect(-2, -16, 4, 18);
    ctx.strokeRect(-2, -16, 4, 18);
    ctx.restore();
    return;
  }

  if (id === 'leandro') {
    // Silla de barbería con otro personaje del elenco sentado + Leandro cortándole el pelo
    const client = opts.idleClientChar ?? 'gustavo';
    ctx.save();
    ctx.translate(22 * opts.facing, 0);
    ctx.scale(propScale, propScale);
    // Base cromada y silla roja de barbería
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(-14, -6, 28, 6);
    ctx.fillRect(-4, -22, 8, 16);
    ctx.fillStyle = '#B91C1C';
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-18, -32, 36, 12, 4);
    ctx.fill();
    ctx.stroke();

    // Cliente sentado con capa de barbería
    drawCharacterSprite(ctx, client, {
      ...opts,
      cx: 0,
      bottomY: -8,
      isIdleScene: false,
      isCrouching: true,
      expression: 'idle',
      scale: 0.88,
    });
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-14, -44);
    ctx.lineTo(14, -44);
    ctx.lineTo(18, -22);
    ctx.lineTo(-18, -22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    drawCharacterSprite(ctx, 'leandro', {
      ...opts,
      cx: -16 * opts.facing,
      bottomY: 0,
      isIdleScene: false,
      expression: 'idle',
      scale: 1,
    });

    // Tijeras de peluquero abriendo y cerrando
    ctx.save();
    ctx.translate(6 * opts.facing, -58);
    const snip = Math.abs(Math.sin(t * 10)) * 0.35;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(12 * opts.facing, -4 - snip * 8);
    ctx.moveTo(0, 0);
    ctx.lineTo(12 * opts.facing, 4 + snip * 8);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // GUSTAVO: Micrófono en trípode + guitarra tocando y cantando
  ctx.save();
  ctx.translate(28 * opts.facing, 0);
  ctx.scale(propScale, propScale);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(0, -14);
  ctx.lineTo(10, 0);
  ctx.moveTo(0, -14);
  ctx.lineTo(0, -64);
  ctx.stroke();
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(0, -66, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawCharacterSprite(ctx, 'gustavo', {
    ...opts,
    cx: 0,
    bottomY: 0,
    isIdleScene: false,
    powerActive: true,
    expression: 'celebrate',
    scale: 1,
  });

  ctx.fillStyle = '#FFE600';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('♪', 24 * opts.facing, -76 - ((t * 18) % 16));
  ctx.fillStyle = '#00F5D4';
  ctx.fillText('♫', 10 * opts.facing, -84 - (((t + 0.5) * 18) % 16));
}

function drawMicaelaInBed(ctx: CanvasRenderingContext2D, time: number): void {
  // Cama colorida acogedora con almohada pastel y "Zzz"
  ctx.fillStyle = '#78350F';
  ctx.strokeStyle = '#110B1E';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-36, -24, 72, 24, 5);
  ctx.fill();
  ctx.stroke();

  // Cabecera colorida
  ctx.fillStyle = '#A855F7';
  ctx.fillRect(-38, -36, 7, 36);
  ctx.strokeRect(-38, -36, 7, 36);

  // Colchón y frazada colorida
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(-31, -21, 63, 8);
  const quiltG = ctx.createLinearGradient(-14, -23, 34, -8);
  quiltG.addColorStop(0, '#F472B6');
  quiltG.addColorStop(0.5, '#C084FC');
  quiltG.addColorStop(1, '#38BDF8');
  ctx.fillStyle = quiltG;
  ctx.beginPath();
  ctx.roundRect(-14, -23, 48, 16, 6);
  ctx.fill();
  ctx.stroke();

  // Cabeza tranquila sobre almohada
  ctx.fillStyle = '#FCE7F3';
  ctx.beginPath();
  ctx.ellipse(-22, -23, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F4CBB0';
  ctx.beginPath();
  ctx.arc(-18, -27, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5C3A21';
  ctx.beginPath();
  ctx.arc(-20, -29, 9.5, Math.PI * 0.7, Math.PI * 1.95);
  ctx.fill();

  // Ojo cerrado plácido
  ctx.strokeStyle = '#110B1E';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-16, -26);
  ctx.lineTo(-12, -26);
  ctx.stroke();

  const zOffset = (time * 18) % 24;
  ctx.fillStyle = '#E9D5FF';
  ctx.font = 'bold 13px "Bungee", sans-serif';
  ctx.fillText('Zzz', -6 + Math.sin(time * 2) * 3, -40 - zOffset * 0.6);
}

function drawMicaelaCloud(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.save();
  ctx.translate(0, 6 + Math.sin(time * 5) * 2);
  const cGrad = ctx.createLinearGradient(0, -14, 0, 14);
  cGrad.addColorStop(0, '#FDF2F8');
  cGrad.addColorStop(1, '#DDD6FE');
  ctx.fillStyle = cGrad;
  ctx.strokeStyle = '#7C3AED';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 2, 32, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(-18, 4, 16, 10, 0, 0, Math.PI * 2);
  ctx.ellipse(18, 4, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#A855F7';
  ctx.font = 'bold 11px "Bungee", sans-serif';
  ctx.fillText('Zzz', 20, -10);
  ctx.restore();
}

export function drawFrontCharacterSprite(
  ctx: CanvasRenderingContext2D,
  id: CharacterId,
  cx: number,
  bottomY: number,
  time: number,
  waveOffset = 0,
  scale = 1
): void {
  ctx.save();
  ctx.translate(cx, bottomY);
  ctx.scale(scale, scale);

  const skin = id === 'leandro' ? '#E9B996' : id === 'rodolfo' ? '#EEC09D' : '#F4CBB0';
  const pants =
    id === 'gustavo'
      ? '#3B6EA5'
      : id === 'micaela'
        ? '#1B5E3F'
        : '#1E293B';
  const shirt =
    id === 'marcela'
      ? '#FFFFFF'
      : id === 'leandro'
        ? '#5B7C99'
        : '#18181B';

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  drawLimbSegment(ctx, -6, -30, -7, -4, 4.2, 3.2, id === 'micaela' || id === 'rodolfo' ? skin : pants);
  drawLimbSegment(ctx, 6, -30, 7, -4, 4.2, 3.2, id === 'micaela' || id === 'rodolfo' ? skin : pants);
  drawShoe(ctx, -8, -1, '#1E293B', '#F8FAFC', id === 'micaela');
  drawShoe(ctx, 8, -1, '#1E293B', '#F8FAFC', id === 'micaela');

  ctx.fillStyle = shirt;
  ctx.strokeStyle = '#110B1E';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(-12, -54, 24, 26, 6);
  ctx.fill();
  ctx.stroke();

  if (id === 'micaela') {
    ctx.fillStyle = '#1B5E3F';
    ctx.fillRect(-13, -32, 26, 12);
    ctx.strokeRect(-13, -32, 26, 12);
  } else if (id === 'leandro') {
    ctx.fillStyle = '#10B981';
    ctx.fillRect(-7, -46, 14, 7);
  }

  drawLimbSegment(ctx, -13, -50, -17, -30, 3.4, 2.6, id === 'marcela' ? '#FFFFFF' : skin);
  const waveAng = Math.sin(time * 7 + waveOffset) * 5;
  drawLimbSegment(ctx, 13, -50, 21 + waveAng, -69, 3.4, 2.6, id === 'marcela' ? '#FFFFFF' : skin);

  ctx.fillStyle = skin;
  ctx.strokeStyle = '#110B1E';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, -64, 12.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle =
    id === 'marcela'
      ? '#FEF08A'
      : id === 'rodolfo'
        ? '#64748B'
        : id === 'micaela'
          ? '#5C3A21'
          : '#18181B';
  ctx.beginPath();
  ctx.arc(0, -67, 12.5, Math.PI, Math.PI * 2);
  ctx.fill();

  if (id === 'marcela') {
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-8, -67, 7, 4.5);
    ctx.fillRect(1, -67, 7, 4.5);
  } else {
    ctx.fillStyle = '#110B1E';
    ctx.beginPath();
    ctx.arc(-4.2, -64, 1.7, 0, Math.PI * 2);
    ctx.arc(4.2, -64, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#110B1E';
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.arc(0, -61, 4.8, 0.15, Math.PI - 0.15);
  ctx.stroke();

  ctx.restore();
}

/* ============================================================================
 *  JUGADOR, RENAULT 19 (CON CAPOT ABIERTO EN IDLE), PERRO Y ENEMIGOS
 * ========================================================================== */

function drawPlayer(ctx: CanvasRenderingContext2D, state: RenderSceneState): void {
  const p = state.player;
  if (p.invulnTimer > 0 && Math.floor(state.time * 16) % 2 === 0 && p.carRewindTimer <= 0) {
    ctx.save();
    ctx.globalAlpha = 0.48;
    drawPlayerInner(ctx, state);
    ctx.restore();
    return;
  }
  drawPlayerInner(ctx, state);
}

function drawPlayerInner(ctx: CanvasRenderingContext2D, state: RenderSceneState): void {
  const p = state.player;
  const cx = p.x + p.w / 2;
  const bottomY = p.y + p.h;

  ctx.fillStyle = 'rgba(10, 8, 22, 0.34)';
  ctx.beginPath();
  ctx.ellipse(cx, bottomY + 2, p.isCrouching ? 22 : 18, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (state.characterId === 'lautaro' && p.carRewindTimer > 0) {
    drawRenault19(ctx, cx, bottomY, p.facing, state.time, false);
    return;
  }

  const isFrozen = p.frozenTimer > 0;
  const shiverX = isFrozen ? Math.sin(state.time * 58) * 1.8 : 0;

  let expression: CharacterExpression = 'normal';
  if (isFrozen) expression = 'frozen';
  else if (p.hurtAnimTimer > 0) expression = 'hurt';
  else if (p.celebrateTimer > 0) expression = 'celebrate';
  else if (p.powerTimer > 0) expression = 'power';
  else if (p.isCrouching) expression = 'crouch';
  else if (!p.onGround && p.vy < -60) expression = 'jump';
  else if (!p.onGround && p.vy > 140) expression = 'fall';

  drawCharacterSprite(ctx, state.characterId, {
    cx: cx + shiverX,
    bottomY,
    facing: p.facing,
    walkCycle: p.walkCycle,
    isMoving: !isFrozen && Math.abs(p.vx) > 25,
    onGround: p.onGround,
    vy: p.vy,
    time: state.time,
    powerActive: p.powerTimer > 0,
    isCrouching: p.isCrouching,
    isSleepingInBed: p.isSleepingInBed,
    isIdleScene: p.isIdleScene,
    idleTime: p.idleTime,
    idleClientChar: p.idleClientChar,
    expression,
    scale: 1,
  });

  if (isFrozen) {
    drawPlayerIceBlock(ctx, cx + shiverX * 0.4, bottomY, p, state.time);
  }
}

function drawPlayerIceBlock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bottomY: number,
  p: PlayerState,
  time: number
): void {
  const bx = cx - 28;
  const by = bottomY - 84;
  const bw = 56;
  const bh = 86;
  const progress = Math.max(
    0,
    Math.min(1, 1 - p.frozenTimer / Math.max(0.2, p.frozenMaxTimer))
  );

  ctx.save();

  // Cuerpo translúcido de hielo facetado
  const iceG = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  iceG.addColorStop(0, 'rgba(224, 242, 254, 0.72)');
  iceG.addColorStop(0.45, 'rgba(125, 211, 252, 0.56)');
  iceG.addColorStop(1, 'rgba(14, 165, 233, 0.68)');
  ctx.fillStyle = iceG;
  ctx.strokeStyle = '#E0F2FE';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 8);
  ctx.fill();
  ctx.stroke();

  // Contorno azul profundo
  ctx.strokeStyle = '#0369A1';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);

  // Reflejos diagonales brillantes sobre el bloque
  ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
  ctx.beginPath();
  ctx.moveTo(bx + 6, by + 2);
  ctx.lineTo(bx + 22, by + 2);
  ctx.lineTo(bx + 6, by + 34);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(bx + bw - 18, by + bh - 4);
  ctx.lineTo(bx + bw - 4, by + bh - 4);
  ctx.lineTo(bx + bw - 4, by + bh - 26);
  ctx.closePath();
  ctx.fill();

  // Grietas crecientes al acercarse a romperse o al agitar controles
  const crackLevel = progress + Math.min(0.45, p.frozenShakeCount * 0.14);
  if (crackLevel > 0.25) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(bx + 10, by + 18);
    ctx.lineTo(bx + 24, by + 30);
    ctx.lineTo(bx + 18, by + 44);
    if (crackLevel > 0.52) {
      ctx.moveTo(bx + bw - 8, by + 28);
      ctx.lineTo(bx + bw - 24, by + 40);
      ctx.lineTo(bx + bw - 16, by + 58);
    }
    if (crackLevel > 0.78) {
      ctx.moveTo(bx + 24, by + 30);
      ctx.lineTo(bx + bw - 24, by + 40);
    }
    ctx.stroke();
  }

  // Indicación rápida para zafar agitando controles
  const pulse = Math.sin(time * 16) > 0;
  ctx.fillStyle = pulse ? '#FFFFFF' : '#7DD3FC';
  ctx.strokeStyle = '#082F49';
  ctx.lineWidth = 3;
  ctx.font = 'bold 10.5px "Bungee", sans-serif';
  ctx.textAlign = 'center';
  ctx.strokeText('AGITA ◄►', cx, by - 8);
  ctx.fillText('AGITA ◄►', cx, by - 8);

  ctx.restore();
}

function drawRenault19(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bottomY: number,
  facing: 1 | -1,
  time: number,
  hoodOpen: boolean
): void {
  ctx.save();
  ctx.translate(cx, bottomY);
  ctx.scale(facing, 1);

  const neon = ctx.createRadialGradient(0, -2, 6, 0, -2, 54);
  neon.addColorStop(0, 'rgba(0, 212, 255, 0.85)');
  neon.addColorStop(1, 'rgba(0, 212, 255, 0)');
  ctx.fillStyle = neon;
  ctx.fillRect(-52, -10, 104, 18);

  const bodyGrad = ctx.createLinearGradient(-44, -36, 44, -8);
  bodyGrad.addColorStop(0, '#CBD5E1');
  bodyGrad.addColorStop(0.5, '#94A3B8');
  bodyGrad.addColorStop(1, '#475569');
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-46, -10);
  ctx.lineTo(-42, -24);
  ctx.lineTo(-18, -38);
  ctx.lineTo(14, -38);
  ctx.lineTo(34, -24);
  ctx.lineTo(48, -20);
  ctx.lineTo(48, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (hoodOpen) {
    // Motor interior y capot abierto
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(24, -25, 22, 8);
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(28, -24, 6, 4);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(24, -24);
    ctx.lineTo(44, -44);
    ctx.stroke();
  }

  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.moveTo(-15, -34);
  ctx.lineTo(12, -34);
  ctx.lineTo(26, -24);
  ctx.lineTo(-22, -24);
  ctx.closePath();
  ctx.fill();

  for (const wx of [-27, 27]) {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(wx, -9, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(wx, -9, 5, hoodOpen ? 0 : time * 12, (hoodOpen ? 0 : time * 12) + Math.PI * 1.4);
    ctx.fill();
  }

  ctx.restore();
}

function drawWhiteDog(ctx: CanvasRenderingContext2D, dog: DogCompanion): void {
  ctx.save();
  ctx.translate(dog.x, dog.y);
  ctx.scale(dog.facing, 1);

  const run = Math.sin(dog.animTime * 16) * 5;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#110B1E';
  ctx.lineWidth = 2.2;

  drawLimbSegment(ctx, -9, -12, -11 - run, 0, 2.6, 2, '#F1F5F9');
  drawLimbSegment(ctx, 9, -12, 11 + run, 0, 2.6, 2, '#FFFFFF');

  // Cola moviéndose
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-13, -15);
  ctx.lineTo(-19, -22 + Math.sin(dog.animTime * 14) * 3);
  ctx.stroke();

  ctx.strokeStyle = '#110B1E';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, -14, 15, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(13, -21, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.ellipse(8, -22, 3, 5.5, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2563EB';
  ctx.fillRect(5, -20, 6, 4);
  ctx.fillStyle = '#110B1E';
  ctx.beginPath();
  ctx.arc(16, -22, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSonicWave(ctx: CanvasRenderingContext2D, w: SonicWave): void {
  ctx.save();
  ctx.strokeStyle = `hsl(${w.hue}, 95%, 62%)`;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(w.x, w.y, w.radius, -Math.PI * 0.42, Math.PI * 0.42);
  ctx.stroke();

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w.x, w.y, w.radius * 0.72, -Math.PI * 0.36, Math.PI * 0.36);
  ctx.stroke();
  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number): void {
  const cx = e.x + e.w / 2;
  const bottomY = e.y + e.h;
  const isTelegraph = e.aiState === 'telegraph';
  const isAttack = e.aiState === 'attack';

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, bottomY + 2, e.w * 0.45, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, bottomY);
  ctx.scale(e.facing, 1);

  if (isTelegraph) {
    ctx.translate(Math.sin(time * 48) * 2.2, 0);
  }

  if (e.type === 'drunk') {
    const sway = isTelegraph ? -0.1 : Math.sin(e.animTime * 4.5) * 0.14;
    ctx.rotate(sway);
    const step = isTelegraph ? 0 : Math.sin(e.animTime * 8) * 7;
    drawLimbSegment(ctx, -4, -26, -6 - step, -2, 4, 3, '#334155');
    drawLimbSegment(ctx, 4, -26, 6 + step, -2, 4, 3, '#475569');
    drawShoe(ctx, -6 - step, 0, '#1E293B', '#94A3B8');
    drawShoe(ctx, 6 + step, 0, '#1E293B', '#94A3B8');

    ctx.fillStyle = '#78350F';
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-12, -52, 24, 28, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#EBB79B';
    ctx.beginPath();
    ctx.arc(0, -60, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FCA5A5';
    ctx.beginPath();
    ctx.arc(6, -59, 3, 0, Math.PI * 2);
    ctx.fill();

    // Brazo alza la botella cuando va a lanzar líquido ardiente
    const handX = isTelegraph ? 13 : 15;
    const handY = isTelegraph ? -56 : -38;
    drawLimbSegment(ctx, 4, -46, handX, handY, 3.2, 2.5, '#EBB79B');
    ctx.fillStyle = isTelegraph ? '#4ADE80' : '#16A34A';
    ctx.beginPath();
    ctx.roundRect(handX - 1, handY - 11, 8, 16, 2);
    ctx.fill();
    ctx.stroke();
  } else if (e.type === 'cone') {
    const step = isTelegraph ? 0 : Math.sin(e.animTime * 11) * 8;
    drawLimbSegment(ctx, -5, -16, -6 - step, -2, 3.5, 2.5, '#1E293B');
    drawLimbSegment(ctx, 5, -16, 6 + step, -2, 3.5, 2.5, '#1E293B');
    drawShoe(ctx, -6 - step, 0, '#EF4444', '#FFFFFF');
    drawShoe(ctx, 6 + step, 0, '#EF4444', '#FFFFFF');

    if (isTelegraph) {
      ctx.rotate(0.12);
    }

    const cGrad = ctx.createLinearGradient(-16, -56, 16, -12);
    cGrad.addColorStop(0, isTelegraph ? '#FDE047' : '#FB923C');
    cGrad.addColorStop(1, '#EA580C');
    ctx.fillStyle = cGrad;
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-18, -14);
    ctx.lineTo(18, -14);
    ctx.lineTo(7, -56);
    ctx.lineTo(-7, -56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.moveTo(-13, -30);
    ctx.lineTo(13, -30);
    ctx.lineTo(10.5, -39);
    ctx.lineTo(-10.5, -39);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = isTelegraph ? '#EF4444' : '#FEF08A';
    ctx.fillRect(-5, -48, 4, 4);
    ctx.fillRect(2, -48, 4, 4);

    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(10, -26);
    ctx.lineTo(28, -32 + Math.sin(time * 10) * 2);
    ctx.lineTo(14, -20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (e.type === 'tire') {
    const r = e.w * 0.48;
    ctx.translate(0, -r);
    const spinSpeed = isAttack ? 22 : isTelegraph ? 18 : 9;
    ctx.rotate(e.animTime * spinSpeed);
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = isTelegraph || isAttack ? '#F97316' : '#030712';
    ctx.lineWidth = isTelegraph || isAttack ? 3.5 : 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isAttack ? '#B91C1C' : '#64748B';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(-e.animTime * spinSpeed);
    ctx.fillStyle = isTelegraph || isAttack ? '#FEF08A' : '#EF4444';
    ctx.beginPath();
    ctx.arc(-5, -3, 3.5, 0, Math.PI * 2);
    ctx.arc(6, -3, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'caliper') {
    // Mordaza de Hierro ("caliper"): mordaza de freno oxidada con mandíbulas articuladas
    const jawOpen = isTelegraph
      ? 12
      : isAttack
        ? 2
        : 5 + Math.abs(Math.sin(e.animTime * 6)) * 4;
    const step = Math.sin(e.animTime * 9) * 5;
    drawLimbSegment(ctx, -8, -14, -10 - step, -2, 4, 3, '#334155');
    drawLimbSegment(ctx, 8, -14, 10 + step, -2, 4, 3, '#475569');

    const bodyGrad = ctx.createLinearGradient(-22, -48, 22, -10);
    bodyGrad.addColorStop(0, '#EA580C');
    bodyGrad.addColorStop(0.55, '#9A3412');
    bodyGrad.addColorStop(1, '#451A03');
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 2.5;

    // Cuerpo trasero de fundición
    ctx.beginPath();
    ctx.roundRect(-24, -46, 30, 34, 8);
    ctx.fill();
    ctx.stroke();

    // Mandíbula superior e inferior
    ctx.fillStyle = '#C2410C';
    ctx.beginPath();
    ctx.roundRect(-4, -46 - jawOpen * 0.3, 28, 13, 5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-4, -22 + jawOpen * 0.2, 28, 12, 5);
    ctx.fill();
    ctx.stroke();

    // Dientes metálicos
    ctx.fillStyle = '#E2E8F0';
    for (let tx = 4; tx <= 18; tx += 7) {
      ctx.beginPath();
      ctx.moveTo(tx, -33 - jawOpen * 0.3);
      ctx.lineTo(tx + 3.5, -27 - jawOpen * 0.3);
      ctx.lineTo(tx + 7, -33 - jawOpen * 0.3);
      ctx.fill();
    }

    // Ojo pistón hidráulico brillante
    ctx.fillStyle = isTelegraph || isAttack ? '#FACC15' : '#EF4444';
    ctx.beginPath();
    ctx.arc(-6, -31, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-4, -31, 2.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Bidón Escupe-Aceite ("oil_drum")
    const squash = isTelegraph ? 0.9 + Math.sin(time * 28) * 0.08 : 1;
    ctx.scale(2 - squash, squash);
    const hop = Math.abs(Math.sin(e.animTime * 6)) * 3;
    ctx.translate(0, -hop);

    const drumGrad = ctx.createLinearGradient(-22, -60, 22, 0);
    drumGrad.addColorStop(0, '#475569');
    drumGrad.addColorStop(0.5, '#1E293B');
    drumGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = drumGrad;
    ctx.strokeStyle = '#090D16';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(-21, -58, 42, 56, 6);
    ctx.fill();
    ctx.stroke();

    // Franja amarilla industrial
    ctx.fillStyle = '#EAB308';
    ctx.fillRect(-19, -32, 38, 10);
    ctx.fillStyle = '#111827';
    for (let sx = -16; sx < 16; sx += 10) {
      ctx.fillRect(sx, -32, 5, 10);
    }

    // Aros de refuerzo del tambor
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-21, -42);
    ctx.lineTo(21, -42);
    ctx.moveTo(-21, -16);
    ctx.lineTo(21, -16);
    ctx.stroke();

    // Boca superior con aceite hirviendo
    ctx.fillStyle = isTelegraph ? '#F97316' : '#7C3AED';
    ctx.beginPath();
    ctx.ellipse(4, -59, 12, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ojos amenazantes
    ctx.fillStyle = isTelegraph ? '#FDE047' : '#EF4444';
    ctx.fillRect(-9, -51, 7, 5);
    ctx.fillRect(5, -51, 7, 5);
    ctx.strokeStyle = '#090D16';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-11, -54);
    ctx.lineTo(-1, -50);
    ctx.moveTo(13, -54);
    ctx.lineTo(3, -50);
    ctx.stroke();
  }

  ctx.restore();

  if (isTelegraph) {
    ctx.save();
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 3.5;
    ctx.font = 'bold 22px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText('!', cx, e.y - 10);
    ctx.fillText('!', cx, e.y - 10);
    ctx.restore();
  }
}

function drawEnemyProjectile(
  ctx: CanvasRenderingContext2D,
  proj: EnemyProjectile
): void {
  ctx.save();
  ctx.translate(proj.x, proj.y);
  ctx.rotate(proj.rot);

  if (proj.kind === 'minicone') {
    ctx.fillStyle = '#FB923C';
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -7);
    ctx.lineTo(12, 0);
    ctx.lineTo(-10, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-4, -3.5, 5, 7);
  } else if (proj.kind === 'booze') {
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, proj.r + 3);
    g.addColorStop(0, '#FEF08A');
    g.addColorStop(0.55, '#4ADE80');
    g.addColorStop(1, '#15803D');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#052E16';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, proj.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // 'oil': gota ardiente de aceite oscuro y naranja
    const g = ctx.createRadialGradient(-2, -2, 2, 0, 0, proj.r + 2);
    g.addColorStop(0, '#FDBA74');
    g.addColorStop(0.45, '#EA580C');
    g.addColorStop(1, '#3B0764');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, proj.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

/* ============================================================================
 *  JEFES (INCLUYE FUEGO EN CABEZA DE CONE_KING + VENTANA SEGURA CLARA)
 * ========================================================================== */

function drawDemonicFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  boss: BossState,
  time: number
): void {
  const isHurt = boss.state === 'hurt';
  const isRecover = boss.state === 'recover';
  const isTelegraph = boss.state === 'telegraph';

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Ojos demoníacos brillantes
  const eyeGlow = isRecover ? '#38BDF8' : isHurt ? '#FEF08A' : '#FF2E2E';
  for (const side of [-1, 1]) {
    const ex = side * 12;
    const ey = -4;

    if (isHurt) {
      // Ojos apretados en X / dolor exagerado
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - 5, ey - 4);
      ctx.lineTo(ex + 5, ey + 4);
      ctx.moveTo(ex + 5, ey - 4);
      ctx.lineTo(ex - 5, ey + 4);
      ctx.stroke();
    } else {
      ctx.save();
      ctx.shadowColor = eyeGlow;
      ctx.shadowBlur = isTelegraph ? 14 : 8;
      ctx.fillStyle = '#090D16';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 7.2, isRecover ? 4.8 : 6.2, side * -0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = eyeGlow;
      ctx.beginPath();
      ctx.ellipse(ex + 1.2, ey, 4.4, isRecover ? 2.8 : 3.8, side * -0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex + 2.2, ey - 1, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Cejas demoníacas gruesas en V pronunciada
    ctx.strokeStyle = '#090D16';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (isRecover) {
      ctx.moveTo(ex - side * 8, ey - 5);
      ctx.lineTo(ex + side * 6, ey - 9);
    } else {
      ctx.moveTo(ex - side * 8, ey - 11);
      ctx.lineTo(ex + side * 6, ey - 4);
    }
    ctx.stroke();
  }

  // Boca demoníaca amplia con colmillos afilados
  const mouthOpen = isHurt ? 11 : isTelegraph ? 10 + Math.sin(time * 24) * 2 : isRecover ? 5 : 8;
  ctx.fillStyle = '#1E060C';
  ctx.strokeStyle = '#090D16';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-17, 7);
  ctx.quadraticCurveTo(0, isRecover ? 13 : 4, 17, 7);
  ctx.quadraticCurveTo(14, 7 + mouthOpen, 0, 8 + mouthOpen);
  ctx.quadraticCurveTo(-14, 7 + mouthOpen, -17, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Lengua oscura y colmillos blancos afilados
  if (!isRecover) {
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.ellipse(0, 7 + mouthOpen * 0.72, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#F8FAFC';
  for (let fx = -12; fx <= 12; fx += 6) {
    const fangH = Math.abs(fx) >= 10 ? 5.5 : 3.5;
    ctx.beginPath();
    ctx.moveTo(fx - 2.4, 7.5);
    ctx.lineTo(fx, 7.5 + fangH);
    ctx.lineTo(fx + 2.4, 7.5);
    ctx.closePath();
    ctx.fill();
  }
  for (const fx of [-9, 9]) {
    ctx.beginPath();
    ctx.moveTo(fx - 2.2, 7.5 + mouthOpen);
    ctx.lineTo(fx, 3.5 + mouthOpen);
    ctx.lineTo(fx + 2.2, 7.5 + mouthOpen);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawBoss(ctx: CanvasRenderingContext2D, boss: BossState, time: number): void {
  const cx = boss.x + boss.w / 2;
  const bottomY = boss.y + boss.h;

  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(cx, bottomY + 3, boss.w * 0.52, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, bottomY);
  ctx.scale(boss.facing, 1);

  if (boss.state === 'hurt') {
    ctx.translate(Math.sin(time * 55) * 4, 0);
  }
  if (boss.invulnTimer > 0 && Math.floor(time * 18) % 2 === 0) {
    ctx.filter = 'brightness(1.65)';
  }

  if (boss.id === 'cone_king') {
    // Sombreado cilíndrico volumétrico para El Cono Verdugo
    const baseG = ctx.createLinearGradient(-46, -12, 46, 0);
    baseG.addColorStop(0, '#9A3412');
    baseG.addColorStop(0.5, '#C2410C');
    baseG.addColorStop(1, '#431407');
    ctx.fillStyle = baseG;
    ctx.strokeStyle = '#090D16';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-48, -14, 96, 14, 5);
    ctx.fill();
    ctx.stroke();

    const coneG = ctx.createLinearGradient(-42, -108, 42, -8);
    coneG.addColorStop(0, '#FDBA74');
    coneG.addColorStop(0.35, '#EA580C');
    coneG.addColorStop(0.78, '#9A3412');
    coneG.addColorStop(1, '#431407');
    ctx.fillStyle = coneG;
    ctx.beginPath();
    ctx.moveTo(-42, -10);
    ctx.lineTo(42, -10);
    ctx.lineTo(18, -108);
    ctx.lineTo(-18, -108);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Franjas reflectantes sombreadas
    const stripeG = ctx.createLinearGradient(-32, 0, 32, 0);
    stripeG.addColorStop(0, '#FFFFFF');
    stripeG.addColorStop(0.6, '#E2E8F0');
    stripeG.addColorStop(1, '#64748B');
    ctx.fillStyle = stripeG;
    ctx.fillRect(-31, -40, 62, 14);
    ctx.strokeRect(-31, -40, 62, 14);
    ctx.fillRect(-25, -66, 50, 11);
    ctx.strokeRect(-25, -66, 50, 11);

    // Corona metálica con sombreado dorado
    const crownG = ctx.createLinearGradient(-18, -124, 18, -106);
    crownG.addColorStop(0, '#FEF08A');
    crownG.addColorStop(0.5, '#FACC15');
    crownG.addColorStop(1, '#B45309');
    ctx.fillStyle = crownG;
    ctx.beginPath();
    ctx.moveTo(-19, -106);
    ctx.lineTo(-12, -126);
    ctx.lineTo(0, -112);
    ctx.lineTo(12, -126);
    ctx.lineTo(19, -106);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cara demoníaca exagerada sobre el cono
    drawDemonicFace(ctx, 2, -84, 0.96, boss, time);

    if (boss.headFireActive) {
      const sway = Math.sin(time * 14) * 7;
      const fh = 42 + Math.sin(time * 18) * 9;
      const fGrad = ctx.createLinearGradient(0, -120, sway, -120 - fh);
      fGrad.addColorStop(0, '#DC2626');
      fGrad.addColorStop(0.5, '#F97316');
      fGrad.addColorStop(1, '#FEF08A');
      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.moveTo(-18, -120);
      ctx.quadraticCurveTo(-18, -120 - fh * 0.6, sway, -120 - fh);
      ctx.quadraticCurveTo(18, -120 - fh * 0.6, 18, -120);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(224, 242, 254, 0.78)';
      for (let i = 0; i < 3; i++) {
        const sy = -128 - ((time * 32 + i * 16) % 28);
        ctx.beginPath();
        ctx.arc(-8 + i * 8, sy, 6 - i, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (boss.id === 'demon_tire') {
    const r = boss.w * 0.48;
    ctx.translate(0, -r);
    const spinAngle = boss.headFireActive ? boss.animTime * 9 : Math.sin(time * 4) * 0.15;

    ctx.save();
    ctx.rotate(spinAngle);
    const tireG = ctx.createRadialGradient(-10, -12, 8, 0, 0, r);
    tireG.addColorStop(0, '#334155');
    tireG.addColorStop(0.55, '#1E293B');
    tireG.addColorStop(0.88, '#0F172A');
    tireG.addColorStop(1, '#020617');
    ctx.fillStyle = tireG;
    ctx.strokeStyle = boss.headFireActive ? '#F97316' : '#38BDF8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pinchos metálicos activos cuando gira con armadura
    if (boss.headFireActive) {
      const spG = ctx.createLinearGradient(0, -r, 0, -r - 14);
      spG.addColorStop(0, '#DC2626');
      spG.addColorStop(1, '#FEF08A');
      ctx.fillStyle = spG;
      ctx.strokeStyle = '#090D16';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI * 2) / 8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang - 0.15) * r, Math.sin(ang - 0.15) * r);
        ctx.lineTo(Math.cos(ang) * (r + 13), Math.sin(ang) * (r + 13));
        ctx.lineTo(Math.cos(ang + 0.15) * r, Math.sin(ang + 0.15) * r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Llanta interior metálica sombreada
    const hubG = ctx.createRadialGradient(-8, -8, 4, 0, 0, r * 0.62);
    hubG.addColorStop(0, '#EF4444');
    hubG.addColorStop(0.65, '#991B1B');
    hubG.addColorStop(1, '#450A0A');
    ctx.fillStyle = hubG;
    ctx.strokeStyle = '#090D16';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    drawDemonicFace(ctx, 2, -2, 1.05, boss, time);

    if (!boss.headFireActive) {
      ctx.fillStyle = '#FFE600';
      for (let s = 0; s < 3; s++) {
        const sx = Math.cos(time * 7 + s * 2.1) * 36;
        const sy = -r - 14 + Math.sin(time * 7 + s * 2.1) * 7;
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('★', sx - 6, sy);
      }
    }
  } else if (boss.id === 'bottle_brute') {
    const botG = ctx.createLinearGradient(-44, -98, 44, 0);
    botG.addColorStop(0, '#FEF3C7');
    botG.addColorStop(0.45, '#FCD34D');
    botG.addColorStop(1, '#B45309');
    ctx.fillStyle = botG;
    ctx.strokeStyle = '#090D16';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-42, -98, 84, 92, 18);
    ctx.fill();
    ctx.stroke();

    // Brillo especular lateral de la botella
    ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
    ctx.beginPath();
    ctx.roundRect(-34, -90, 12, 74, 6);
    ctx.fill();

    // Etiqueta con degradado tóxico
    const lblG = ctx.createLinearGradient(-36, -74, 36, -12);
    lblG.addColorStop(0, '#F97316');
    lblG.addColorStop(0.55, '#DC2626');
    lblG.addColorStop(1, '#7F1D1D');
    ctx.fillStyle = lblG;
    ctx.beginPath();
    ctx.roundRect(-36, -74, 72, 58, 12);
    ctx.fill();
    ctx.stroke();

    // Tapa cerrada (dura) vs destapada en recover (válvula azul expuesta)
    if (boss.headFireActive) {
      const capG = ctx.createLinearGradient(-22, -124, 22, -100);
      capG.addColorStop(0, '#F87171');
      capG.addColorStop(0.5, '#DC2626');
      capG.addColorStop(1, '#7F1D1D');
      ctx.fillStyle = capG;
      ctx.fillRect(-22, -124, 44, 26);
      ctx.strokeRect(-22, -124, 44, 26);
    } else {
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(-16, -112, 32, 14);
      ctx.strokeRect(-16, -112, 32, 14);
      ctx.save();
      ctx.translate(-34, -126 + Math.sin(time * 12) * 4);
      ctx.rotate(-0.45);
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(-16, -8, 32, 16);
      ctx.strokeRect(-16, -8, 32, 16);
      ctx.restore();
    }

    drawDemonicFace(ctx, 2, -46, 1.04, boss, time);
  } else if (boss.id === 'caliper_titan') {
    // Jefe 4: El Titán Mordaza Hidráulica
    const bodyG = ctx.createLinearGradient(-52, -112, 52, 0);
    bodyG.addColorStop(0, '#FB923C');
    bodyG.addColorStop(0.42, '#C2410C');
    bodyG.addColorStop(0.85, '#7C2D12');
    bodyG.addColorStop(1, '#3B1206');
    ctx.fillStyle = bodyG;
    ctx.strokeStyle = '#090D16';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-52, -96, 104, 86, 16);
    ctx.fill();
    ctx.stroke();

    // Bisel metálico iluminado
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(-44, -90, 88, 10);

    // Pistón superior rojo expuesto cuando la mordaza está atascada en el asfalto
    if (!boss.headFireActive) {
      const pisG = ctx.createLinearGradient(-24, -114, 24, -92);
      pisG.addColorStop(0, '#F87171');
      pisG.addColorStop(1, '#991B1B');
      ctx.fillStyle = pisG;
      ctx.beginPath();
      ctx.roundRect(-24, -114, 48, 22, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFE600';
      ctx.fillRect(-10, -108, 20, 8);
    } else {
      const snap = Math.abs(Math.sin(time * 10)) * 8;
      const jawG = ctx.createLinearGradient(0, -124, 0, -92);
      jawG.addColorStop(0, '#F8FAFC');
      jawG.addColorStop(1, '#64748B');
      ctx.fillStyle = jawG;
      ctx.beginPath();
      ctx.moveTo(-46, -94);
      ctx.lineTo(-18, -124 + snap);
      ctx.lineTo(-6, -94);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(46, -94);
      ctx.lineTo(18, -124 + snap);
      ctx.lineTo(6, -94);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    const lowG = ctx.createLinearGradient(-42, -26, 42, -4);
    lowG.addColorStop(0, '#94A3B8');
    lowG.addColorStop(1, '#334155');
    ctx.fillStyle = lowG;
    ctx.beginPath();
    ctx.roundRect(-42, -26, 84, 22, 6);
    ctx.fill();
    ctx.stroke();

    drawDemonicFace(ctx, 2, -58, 1.15, boss, time);
  } else {
    // JEFE FINAL: CLIENTE MOLESTO (2 FASES + TRANSFORMACIÓN + ASOMADO AL AUTO)
    if (boss.state === 'transform') {
      const auraR = 75 + Math.sin(time * 24) * 18;
      const auraG = ctx.createRadialGradient(0, -56, 12, 0, -56, auraR);
      auraG.addColorStop(0, 'rgba(255, 230, 0, 0.95)');
      auraG.addColorStop(0.5, 'rgba(239, 68, 68, 0.65)');
      auraG.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = auraG;
      ctx.beginPath();
      ctx.arc(0, -56, auraR, 0, Math.PI * 2);
      ctx.fill();
    }

    if (boss.phase === 1) {
      // FASE 1: Cliente Molesto a pie con llave/disco roto y rostro demoníaco exagerado
      const step = Math.abs(boss.vx) > 25 ? Math.sin(boss.animTime * 11) * 9 : 0;
      drawLimbSegment(ctx, -10, -40, -12 - step, -4, 7, 5, '#1E293B');
      drawLimbSegment(ctx, 10, -40, 12 + step, -4, 7, 5, '#334155');
      drawShoe(ctx, -12 - step, 0, '#0F172A', '#94A3B8');
      drawShoe(ctx, 12 + step, 0, '#0F172A', '#94A3B8');

      // Chaqueta/campera con sombreado multi-tono
      const jktG = ctx.createLinearGradient(-24, -84, 24, -36);
      jktG.addColorStop(0, '#DC2626');
      jktG.addColorStop(0.55, '#991B1B');
      jktG.addColorStop(1, '#450A0A');
      ctx.fillStyle = jktG;
      ctx.strokeStyle = '#090D16';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-24, -84, 48, 48, 10);
      ctx.fill();
      ctx.stroke();

      // Camisa interior y corbata desarreglada
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.moveTo(-7, -84);
      ctx.lineTo(7, -84);
      ctx.lineTo(0, -64);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-3, -78, 6, 22);

      // Brazo levantando disco de freno roto / llave amenazante
      const armShake = boss.state === 'telegraph' ? Math.sin(time * 28) * 6 : 0;
      drawLimbSegment(ctx, 18, -76, 30, -56 + armShake, 5.5, 4.2, '#991B1B');
      ctx.fillStyle = '#CBD5E1';
      ctx.strokeStyle = '#090D16';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(33, -54 + armShake, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(33, -54 + armShake, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Cabeza grande demoníaca roja de furia
      const headG = ctx.createRadialGradient(-4, -104, 4, 0, -98, 25);
      headG.addColorStop(0, '#FCA5A5');
      headG.addColorStop(0.5, '#EF4444');
      headG.addColorStop(1, '#7F1D1D');
      ctx.fillStyle = headG;
      ctx.beginPath();
      ctx.arc(0, -98, 23, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pelo revuelto puntiagudo
      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.moveTo(-22, -102);
      ctx.lineTo(-16, -124);
      ctx.lineTo(-4, -115);
      ctx.lineTo(4, -128);
      ctx.lineTo(14, -114);
      ctx.lineTo(22, -122);
      ctx.lineTo(21, -102);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      drawDemonicFace(ctx, 4, -98, 0.96, boss, time);
    } else {
      // FASE 2: Auto endemoniado con el Cliente Molesto ASOMADO POR LA VENTANILLA
      const rumble = Math.abs(boss.vx) > 25 ? Math.sin(time * 32) * 1.8 : 0;
      ctx.translate(0, rumble);

      // Chasis deportivo con degradado metálico y sombreado profundo
      const carG = ctx.createLinearGradient(-80, -86, 80, -10);
      carG.addColorStop(0, '#F87171');
      carG.addColorStop(0.4, '#B91C1C');
      carG.addColorStop(0.8, '#581C87');
      carG.addColorStop(1, '#1E1B4B');
      ctx.fillStyle = carG;
      ctx.strokeStyle = boss.headFireActive ? '#EF4444' : '#38BDF8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-78, -14);
      ctx.lineTo(-76, -46);
      carRoofOutline(ctx);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Reflejo de carrocería
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.beginPath();
      ctx.roundRect(-64, -44, 130, 8, 4);
      ctx.fill();

      // Capot abierto echando humo cuando está en recover (window open to stomp)
      if (!boss.headFireActive) {
        ctx.save();
        ctx.translate(36, -46);
        ctx.rotate(-0.48);
        ctx.fillStyle = '#991B1B';
        ctx.strokeStyle = '#090D16';
        ctx.lineWidth = 2.5;
        ctx.fillRect(0, -5, 40, 6);
        ctx.strokeRect(0, -5, 40, 6);
        ctx.restore();

        ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
        for (let s = 0; s < 3; s++) {
          const sy = -54 - ((time * 42 + s * 14) % 28);
          ctx.beginPath();
          ctx.arc(54 + s * 6, sy, 7 - s, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Ventanilla abierta + parabrisas sombreado
      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#090D16';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-40, -76);
      ctx.lineTo(14, -76);
      ctx.lineTo(32, -48);
      ctx.lineTo(-50, -48);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // CLIENTE MOLESTO ASOMADO POR LA VENTANILLA (cabeza y puño furioso)
      ctx.save();
      const leanOut = boss.state === 'telegraph' ? 8 : Math.sin(time * 5) * 2.5;
      ctx.translate(-8 + leanOut, -54);

      // Puño golpeando la puerta del auto
      ctx.fillStyle = '#EF4444';
      ctx.strokeStyle = '#090D16';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(24, 2 + Math.sin(time * 12) * 3, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Cabeza demoníaca asomada fuera del marco de la ventanilla
      const headG = ctx.createRadialGradient(-3, -24, 3, 0, -20, 21);
      headG.addColorStop(0, '#FCA5A5');
      headG.addColorStop(0.55, '#DC2626');
      headG.addColorStop(1, '#7F1D1D');
      ctx.fillStyle = headG;
      ctx.beginPath();
      ctx.arc(0, -20, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pelo puntiagudo furioso
      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.moveTo(-18, -26);
      ctx.lineTo(-14, -44);
      ctx.lineTo(-3, -36);
      ctx.lineTo(5, -46);
      ctx.lineTo(13, -34);
      ctx.lineTo(19, -40);
      ctx.lineTo(18, -24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      drawDemonicFace(ctx, 3, -19, 0.84, boss, time);
      ctx.restore();

      // Faro delantero demoníaco brillante + rejilla con colmillos
      ctx.fillStyle = boss.headFireActive ? '#FEF08A' : '#38BDF8';
      ctx.beginPath();
      ctx.ellipse(76, -28, 7, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#090D16';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Ruedas aleación giratorias sombreadas
      for (const wx of [-48, 48]) {
        ctx.save();
        ctx.translate(wx, -14);
        ctx.rotate(boss.animTime * (boss.vx * 0.04));
        ctx.fillStyle = '#090D16';
        ctx.beginPath();
        ctx.arc(0, 0, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        const rimG = ctx.createRadialGradient(-2, -2, 2, 0, 0, 9);
        rimG.addColorStop(0, '#F8FAFC');
        rimG.addColorStop(1, '#64748B');
        ctx.fillStyle = rimG;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-7, -1.5, 14, 3);
        ctx.fillRect(-1.5, -7, 3, 14);
        ctx.restore();
      }
    }
  }

  ctx.restore();

  if (boss.state === 'transform') {
    ctx.save();
    ctx.fillStyle = '#FFE600';
    ctx.strokeStyle = '#090D16';
    ctx.lineWidth = 4;
    ctx.font = 'bold 20px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText('¡FASE 2 · AL AUTO!', cx, boss.y - 24);
    ctx.fillText('¡FASE 2 · AL AUTO!', cx, boss.y - 24);
    ctx.restore();
  } else if (boss.state === 'telegraph') {
    ctx.save();
    ctx.fillStyle = '#EF4444';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.font = 'bold 26px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText('¡!', cx, boss.y - 24);
    ctx.fillText('¡!', cx, boss.y - 24);
    ctx.restore();
  } else if (boss.state === 'recover' && !boss.headFireActive) {
    const label =
      boss.id === 'cone_king'
        ? '▼ ¡ENFRIADO · SALTA!'
        : boss.id === 'demon_tire'
          ? '▼ ¡MAREADA · SALTA!'
          : boss.id === 'bottle_brute'
            ? '▼ ¡SIN TAPA · SALTA!'
            : boss.id === 'caliper_titan'
              ? '▼ ¡ATASCADA · SALTA!'
              : boss.phase === 1
                ? '▼ ¡SIN ALIENTO · SALTA!'
                : '▼ ¡MOTOR RECALENTADO · SALTA!';
    const bounce = Math.sin(time * 9) * 5;
    ctx.save();
    ctx.fillStyle = '#4ADE80';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3;
    ctx.font = 'bold 14px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText(label, cx, boss.y - 26 + bounce);
    ctx.fillText(label, cx, boss.y - 26 + bounce);
    ctx.restore();
  }

  if (boss.speechText && boss.speechTimer > 0) {
    drawBossSpeechBubble(ctx, boss);
  }
}

function carRoofOutline(ctx: CanvasRenderingContext2D): void {
  ctx.lineTo(-54, -50);
  ctx.lineTo(-42, -82);
  ctx.lineTo(18, -82);
  ctx.lineTo(42, -48);
  ctx.lineTo(78, -42);
  ctx.lineTo(80, -14);
}

function drawBossSpeechBubble(
  ctx: CanvasRenderingContext2D,
  boss: BossState
): void {
  if (!boss.speechText) return;
  const cx = Math.max(150, Math.min(1130, boss.x + boss.w / 2));
  const bubbleY = boss.y - (boss.state === 'recover' ? 76 : 48);

  ctx.save();
  ctx.font = 'bold 14px "Fredoka", "Segoe UI", sans-serif';
  const textWidth = ctx.measureText(boss.speechText).width;
  const bw = Math.max(140, textWidth + 28);
  const bh = 36;
  const bx = cx - bw / 2;
  const by = bubbleY - bh;

  // Sombra de nube cómic
  ctx.fillStyle = 'rgba(15, 23, 42, 0.36)';
  ctx.beginPath();
  ctx.roundRect(bx + 3, by + 4, bw, bh, 14);
  ctx.fill();

  // Cuerpo blanco crema con contorno grueso
  ctx.fillStyle = '#FFFDF5';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 14);
  ctx.fill();
  ctx.stroke();

  // Cola de la nubecita apuntando al jefe
  ctx.fillStyle = '#FFFDF5';
  ctx.beginPath();
  ctx.moveTo(cx - 8, by + bh - 1);
  ctx.lineTo(cx, by + bh + 12);
  ctx.lineTo(cx + 8, by + bh - 1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 8, by + bh);
  ctx.lineTo(cx, by + bh + 12);
  ctx.lineTo(cx + 8, by + bh);
  ctx.stroke();

  ctx.fillStyle = '#991B1B';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`"${boss.speechText}"`, cx, by + bh / 2 + 1);
  ctx.restore();
}

function drawBossProjectile(
  ctx: CanvasRenderingContext2D,
  proj: BossProjectile
): void {
  ctx.save();
  ctx.translate(proj.x, proj.y);
  ctx.rotate(proj.rot);

  if (proj.kind === 'blade') {
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-proj.r, -4);
    ctx.lineTo(proj.r, 0);
    ctx.lineTo(-proj.r, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (proj.kind === 'bottle') {
    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-8, -11, 16, 22, 4);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = proj.kind === 'spark' ? '#FACC15' : '#94A3B8';
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, proj.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

/* ============================================================================
 *  PARTÍCULAS, POP BURSTS Y LUCES ADITIVAS
 * ========================================================================== */

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const pt of particles) {
    const alpha = Math.max(0, pt.life / pt.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pt.color;
    ctx.strokeStyle = pt.color;

    if (pt.shape === 'ring') {
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (1.7 - alpha * 0.7), 0, Math.PI * 2);
      ctx.stroke();
    } else if (pt.shape === 'note') {
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('♪', pt.x, pt.y);
    } else {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawPopBursts(ctx: CanvasRenderingContext2D, bursts: PopBurst[]): void {
  for (const pop of bursts) {
    const progress = 1 - pop.life / pop.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress * 0.9);
    ctx.translate(pop.x, pop.y - progress * 30);
    ctx.font = 'bold 20px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#110B1E';
    ctx.strokeText(pop.text, 0, 0);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, 0, 0);
    ctx.restore();
  }
}

function drawAdditiveLights(
  ctx: CanvasRenderingContext2D,
  state: RenderSceneState,
  viewW: number
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (const h of state.hazards) {
    const cx = h.x + h.w / 2;
    if (cx < state.cameraX - 180 || cx > state.cameraX + viewW + 180) continue;

    if (h.type === 'ice_column') {
      const icePhase = getPulsingTrapPhase(h, state.time);
      if (icePhase.state === 'idle') continue;
      const steps = icePhase.state === 'active' && h.h > 260 ? 3 : 1;
      for (let s = 0; s < steps; s++) {
        const cy =
          icePhase.state === 'active'
            ? h.y + ((s + 0.5) / steps) * h.h
            : h.direction === 'down'
              ? h.y + 30
              : h.y + h.h - 24;
        const rad = Math.max(h.w, 105) * 0.95;
        const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, rad);
        g.addColorStop(
          0,
          icePhase.state === 'warning'
            ? 'rgba(186, 230, 253, 0.24)'
            : 'rgba(125, 211, 252, 0.34)'
        );
        g.addColorStop(1, 'rgba(14, 165, 233, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }

    if (h.type === 'updraft') {
      const airPhase = getPulsingTrapPhase(h, state.time);
      if (airPhase.state === 'idle') continue;
      const cy = h.y + h.h - 40;
      const rad = Math.max(h.w, 110);
      const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, rad);
      g.addColorStop(
        0,
        airPhase.state === 'warning'
          ? 'rgba(250, 204, 21, 0.22)'
          : 'rgba(125, 211, 252, 0.30)'
      );
      g.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    if (h.type === 'suction') {
      const sucPhase = getPulsingTrapPhase(h, state.time);
      if (sucPhase.state === 'idle') continue;
      const cy = 595;
      const rad = Math.max(h.w, 120);
      const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, rad);
      g.addColorStop(
        0,
        sucPhase.state === 'warning'
          ? 'rgba(232, 121, 249, 0.24)'
          : 'rgba(168, 85, 247, 0.38)'
      );
      g.addColorStop(1, 'rgba(126, 34, 206, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    if (h.type !== 'fire') continue;
    const firePhase = getPulsingFirePhase(h, state.time);
    if (firePhase.state === 'embers') continue;

    if (h.isSprinkler && firePhase.state === 'active') {
      const steps = h.h > 260 ? 3 : 2;
      for (let s = 0; s < steps; s++) {
        const cy = h.y + ((s + 0.5) / steps) * h.h;
        const rad = Math.max(h.w, 120) * 1.05;
        const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, rad);
        g.addColorStop(0, 'rgba(255, 195, 65, 0.36)');
        g.addColorStop(0.55, 'rgba(255, 110, 20, 0.22)');
        g.addColorStop(1, 'rgba(255, 60, 0, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const cy =
        h.isSprinkler && h.direction === 'down'
          ? h.y + 30
          : h.isSprinkler && (h.direction === 'left' || h.direction === 'right')
            ? h.y + h.h * 0.5
            : h.y + h.h - 24;
      const rad = Math.max(h.w * 0.85, 95);
      const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, rad);
      g.addColorStop(
        0,
        firePhase.state === 'warning'
          ? 'rgba(255, 190, 40, 0.28)'
          : 'rgba(255, 140, 30, 0.34)'
      );
      g.addColorStop(1, 'rgba(255, 80, 0, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const proj of state.enemyProjectiles) {
    if (proj.kind === 'minicone') continue;
    const glow = ctx.createRadialGradient(proj.x, proj.y, 2, proj.x, proj.y, 28);
    glow.addColorStop(
      0,
      proj.kind === 'booze' ? 'rgba(74, 222, 128, 0.38)' : 'rgba(249, 115, 22, 0.42)'
    );
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 28, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.boss && state.boss.active && state.boss.headFireActive) {
    const bx = state.boss.x + state.boss.w / 2;
    const by = state.boss.y - 20;
    const g = ctx.createRadialGradient(bx, by, 6, bx, by, 72);
    g.addColorStop(0, 'rgba(255, 140, 30, 0.48)');
    g.addColorStop(1, 'rgba(255, 60, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, 72, 0, Math.PI * 2);
    ctx.fill();
  }

  const tod = state.level.palette.timeOfDay;
  if (tod === 'sunset' || tod === 'night') {
    for (const g of state.platforms) {
      if (g.kind !== 'ground') continue;
      for (let px = g.x + 110; px < g.x + g.w - 110; px += 340) {
        if (Math.floor(px / 340) % 2 !== 1) continue;
        if (px < state.cameraX - 150 || px > state.cameraX + viewW + 150) continue;
        const cone = ctx.createRadialGradient(px + 30, g.y - 175, 4, px + 30, g.y - 90, 125);
        cone.addColorStop(0, tod === 'night' ? 'rgba(254, 240, 138, 0.44)' : 'rgba(254, 240, 138, 0.28)');
        cone.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.arc(px + 30, g.y - 110, 125, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

function drawSeasonalWeather(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  state: RenderSceneState
): void {
  const { palette } = state.level;
  const t = state.time;
  const ambientWind = state.level.ambientWindX ?? 0;

  ctx.save();

  if (palette.ambientTint) {
    ctx.fillStyle = palette.ambientTint;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  // Líneas de ráfagas de viento en niveles con viento ambiental
  if (ambientWind !== 0) {
    const dir = ambientWind >= 0 ? 1 : -1;
    const speed = 290 + Math.abs(ambientWind) * 2.1;
    ctx.strokeStyle =
      palette.season === 'autumn'
        ? 'rgba(254, 215, 170, 0.28)'
        : 'rgba(224, 242, 254, 0.30)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const rawX = (i * 157 + t * speed * dir - state.cameraX * 0.45) % (viewW + 180);
      const gx = rawX < -90 ? rawX + viewW + 180 : rawX;
      const gy = 65 + ((i * 89) % (viewH - 130));
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + dir * 74, gy + Math.sin(t * 5 + i) * 4);
      ctx.stroke();
    }
  }

  if (palette.season === 'spring') {
    const windShift = ambientWind * 1.4;
    for (let i = 0; i < 22; i++) {
      const rawX =
        (i * 117 + t * (28 + windShift + (i % 4) * 8) - state.cameraX * 0.25) %
        (viewW + 80);
      const px = rawX < -40 ? rawX + viewW + 80 : rawX;
      const py = ((i * 73 + t * (26 + (i % 3) * 9)) % (viewH + 40)) - 20;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255, 255, 255, 0.72)' : 'rgba(251, 207, 232, 0.78)';
      ctx.beginPath();
      ctx.ellipse(px, py, 4.2, 2.3, t * 2 + i, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (palette.season === 'summer' && palette.timeOfDay !== 'night') {
    ctx.fillStyle = 'rgba(254, 240, 138, 0.05)';
    for (let r = 0; r < 3; r++) {
      const rx = viewW * (0.28 + r * 0.24);
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx + 120, 0);
      ctx.lineTo(rx - 60, viewH);
      ctx.lineTo(rx - 180, viewH);
      ctx.closePath();
      ctx.fill();
    }
  } else if (palette.season === 'autumn') {
    const leafColors = ['#F97316', '#EAB308', '#DC2626'];
    const windDir = ambientWind !== 0 ? Math.sign(ambientWind) : -1;
    const windMag = Math.abs(ambientWind) * 1.9;
    for (let i = 0; i < 28; i++) {
      const rawX =
        (i * 131 + t * windDir * (60 + windMag + (i % 5) * 14) - state.cameraX * 0.32) %
        (viewW + 80);
      const px = rawX < -40 ? rawX + viewW + 80 : rawX;
      const py = ((i * 67 + t * (34 + (i % 4) * 10) + Math.sin(t * 3 + i) * 14) % (viewH + 40)) - 20;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(t * 2.5 + i);
      ctx.fillStyle = leafColors[i % leafColors.length];
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (palette.season === 'winter') {
    const windSlant = ambientWind !== 0 ? Math.sign(ambientWind) * (10 + Math.abs(ambientWind) * 0.12) : -9;
    const rainSpeedX = ambientWind !== 0 ? ambientWind * 2.4 : -210;
    ctx.strokeStyle =
      palette.timeOfDay === 'night'
        ? 'rgba(186, 230, 253, 0.38)'
        : 'rgba(226, 232, 240, 0.42)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 62; i++) {
      const rawX = (i * 79 + t * rainSpeedX - state.cameraX * 0.4) % (viewW + 120);
      const rx = rawX < -60 ? rawX + viewW + 120 : rawX;
      const ry = ((i * 53 + t * 540) % (viewH + 60)) - 30;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + windSlant, ry + 22);
    }
    ctx.stroke();

    const mist = ctx.createLinearGradient(0, viewH - 220, 0, viewH);
    mist.addColorStop(0, 'rgba(203, 213, 225, 0)');
    mist.addColorStop(1, 'rgba(203, 213, 225, 0.14)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, viewH - 220, viewW, 220);
  }

  ctx.restore();
}

/* ============================================================================
 *  CINEMÁTICA FINAL DENTRO DEL TALLER FRENAR® (CON CARTEL OFICIAL FRENAR®)
 * ========================================================================== */

function renderCinematicScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: RenderSceneState
): void {
  const cin = state.cinematic;
  const t = cin.elapsed;

  const wallG = ctx.createLinearGradient(0, 0, 0, h - 135);
  wallG.addColorStop(0, '#1C2235');
  wallG.addColorStop(1, '#2B3550');
  ctx.fillStyle = wallG;
  ctx.fillRect(0, 0, w, h - 135);

  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, h - 225, w, 90);
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(0, h - 229, w, 6);

  // Cartel luminoso oficial del taller FRENAR®
  ctx.save();
  ctx.fillStyle = '#0B1120';
  ctx.strokeStyle = '#FFE600';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(w / 2 - 220, 38, 440, 92, 14);
  ctx.fill();
  ctx.stroke();
  drawFrenarLogo(ctx, w / 2, 84, 1.32);
  ctx.restore();

  const floorY = h - 135;
  const floorG = ctx.createLinearGradient(0, floorY, 0, h);
  floorG.addColorStop(0, '#334155');
  floorG.addColorStop(1, '#1E293B');
  ctx.fillStyle = floorG;
  ctx.fillRect(0, floorY, w, 135);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, floorY);
  ctx.lineTo(w, floorY);
  ctx.stroke();

  const carCenterX = w * 0.5;
  const liftY = floorY - 12 - cin.liftProgress * 124;

  // Elevador hidráulico de 2 columnas
  ctx.fillStyle = '#2563EB';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 3;
  ctx.fillRect(carCenterX - 185, floorY - 260, 26, 260);
  ctx.strokeRect(carCenterX - 185, floorY - 260, 26, 260);
  ctx.fillRect(carCenterX + 159, floorY - 260, 26, 260);
  ctx.strokeRect(carCenterX + 159, floorY - 260, 26, 260);

  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(carCenterX - 165, liftY + 6, 330, 12);
  ctx.strokeRect(carCenterX - 165, liftY + 6, 330, 12);

  const isWavingPhase = t >= 7.2;
  const wheelRemoved = t >= 2.8 && t < 7.2;

  drawWorkshopCar(ctx, carCenterX, liftY, wheelRemoved, t);

  if (!isWavingPhase) {
    drawCharacterSprite(ctx, 'lautaro', {
      cx: carCenterX - 230,
      bottomY: floorY,
      facing: 1,
      walkCycle: 0,
      isMoving: false,
      onGround: true,
      vy: 0,
      time: t,
      powerActive: false,
      expression: 'celebrate',
      scale: 1.08,
    });

    drawCharacterSprite(ctx, 'marcela', {
      cx: carCenterX - 305,
      bottomY: floorY,
      facing: 1,
      walkCycle: 0,
      isMoving: false,
      onGround: true,
      vy: 0,
      time: t,
      powerActive: false,
      expression: 'normal',
      scale: 1.08,
    });
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 2;
    ctx.fillRect(carCenterX - 292, floorY - 52 + Math.sin(t * 9) * 1.5, 16, 20);
    ctx.strokeRect(carCenterX - 292, floorY - 52 + Math.sin(t * 9) * 1.5, 16, 20);

    // Rodolfo debajo del auto elevado con su llave mecánica
    ctx.save();
    ctx.translate(carCenterX - 18, floorY - 10);
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-38, -6, 76, 8);
    ctx.fillStyle = '#18181B';
    ctx.fillRect(-26, -20, 44, 14);
    ctx.fillStyle = '#EEC09D';
    ctx.beginPath();
    ctx.arc(24, -15, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#64748B';
    ctx.beginPath();
    ctx.arc(24, -18, 9.5, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(10, -28);
    ctx.rotate(-0.4 + Math.sin(t * 11) * 0.45);
    ctx.fillStyle = '#E2E8F0';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.fillRect(-3, -24, 6, 26);
    ctx.strokeRect(-3, -24, 6, 26);
    ctx.beginPath();
    ctx.arc(0, -26, 7, 0.5, Math.PI * 1.85);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    if (t >= 2.2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let s = 0; s < 5; s++) {
        const sx = carCenterX + Math.sin(t * 17 + s * 2) * 32;
        const sy = liftY + 12 + ((t * 60 + s * 14) % 36);
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawCharacterSprite(ctx, 'leandro', {
      cx: carCenterX + 148,
      bottomY: floorY,
      facing: -1,
      walkCycle: t * 0.5,
      isMoving: wheelRemoved,
      onGround: true,
      vy: 0,
      time: t,
      powerActive: false,
      expression: 'celebrate',
      scale: 1.08,
    });
    if (wheelRemoved) {
      ctx.fillStyle = '#111827';
      ctx.strokeStyle = '#030712';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(carCenterX + 122, floorY - 36, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.arc(carCenterX + 122, floorY - 36, 11, 0, Math.PI * 2);
      ctx.fill();
    }

    drawCharacterSprite(ctx, 'micaela', {
      cx: carCenterX + 245,
      bottomY: floorY,
      facing: -1,
      walkCycle: 0,
      isMoving: false,
      onGround: true,
      vy: 0,
      time: t,
      powerActive: false,
      expression: 'celebrate',
      scale: 1.08,
    });

    drawCharacterSprite(ctx, 'gustavo', {
      cx: carCenterX + 325,
      bottomY: floorY,
      facing: -1,
      walkCycle: 0,
      isMoving: false,
      onGround: true,
      vy: 0,
      time: t,
      powerActive: true,
      expression: 'celebrate',
      scale: 1.08,
    });
  } else {
    const team: CharacterId[] = [
      'rodolfo',
      'marcela',
      'micaela',
      'lautaro',
      'leandro',
      'gustavo',
    ];
    const spacing = 108;
    const startX = w / 2 - ((team.length - 1) * spacing) / 2;

    team.forEach((cid, i) => {
      drawFrontCharacterSprite(
        ctx,
        cid,
        startX + i * spacing,
        floorY + 6,
        t,
        i * 0.7,
        1.14
      );
    });

    drawWhiteDog(ctx, {
      active: true,
      x: startX - 52,
      y: floorY + 6,
      vx: 0,
      facing: 1,
      timer: 1,
      maxTimer: 1,
      attackCooldown: 0,
      lungeTimer: 0,
      animTime: t,
    });
  }

  if (cin.showTheEnd) {
    ctx.save();
    ctx.fillStyle = '#FFE600';
    ctx.strokeStyle = '#110B1E';
    ctx.lineWidth = 8;
    ctx.font = 'bold 72px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText('THE END', w / 2, 212);
    ctx.fillText('THE END', w / 2, 212);
    ctx.restore();
  }
}

function drawWorkshopCar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bottomY: number,
  frontWheelRemoved: boolean,
  time: number
): void {
  ctx.save();
  ctx.translate(cx, bottomY);

  const carG = ctx.createLinearGradient(-150, -90, 150, 0);
  carG.addColorStop(0, '#EF4444');
  carG.addColorStop(0.55, '#DC2626');
  carG.addColorStop(1, '#991B1B');
  ctx.fillStyle = carG;
  ctx.strokeStyle = '#110B1E';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-148, -14);
  ctx.lineTo(-142, -52);
  ctx.lineTo(-76, -86);
  ctx.lineTo(48, -86);
  ctx.lineTo(106, -52);
  ctx.lineTo(148, -42);
  ctx.lineTo(148, -14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#BAE6FD';
  ctx.beginPath();
  ctx.moveTo(-66, -78);
  ctx.lineTo(42, -78);
  ctx.lineTo(88, -52);
  ctx.lineTo(-104, -52);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(-88, -12, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.arc(-88, -12, 13, 0, Math.PI * 2);
  ctx.fill();

  if (!frontWheelRemoved) {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(92, -12, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.arc(92, -12, 13, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(92, -14, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(92, -14, 15, -0.5, 0.9);
    ctx.lineTo(92, -14);
    ctx.closePath();
    ctx.fill();
  }

  if (time > 7.2) {
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.ellipse(144, -30, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
