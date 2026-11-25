/**
 * Tipos centrales del motor de juego "Camino a FRENAR".
 */

export type CharacterId =
  | 'rodolfo'
  | 'marcela'
  | 'gustavo'
  | 'micaela'
  | 'lautaro'
  | 'leandro';

export type GamePhase =
  | 'CHARACTER_SELECT'
  | 'PLAYING'
  | 'PAUSED'
  | 'LEVEL_COMPLETE'
  | 'BOSS_VICTORY'
  | 'FINAL_BOSS_SELECT'
  | 'CINEMATIC'
  | 'GAME_OVER'
  | 'VICTORY';

export type BrakePartType = 'pad' | 'disc' | 'pump' | 'drum' | 'caliper';

export type EnemyType = 'drunk' | 'cone' | 'tire' | 'caliper' | 'oil_drum';

export type TimeOfDay = 'morning' | 'noon' | 'sunset' | 'night';

export type SeasonType = 'spring' | 'summer' | 'autumn' | 'winter';

export type BossId =
  | 'cone_king'
  | 'demon_tire'
  | 'bottle_brute'
  | 'caliper_titan'
  | 'frenar_destroyer';

export type SurfaceType = 'grass' | 'asphalt' | 'metal' | 'ice';

export type HazardType =
  | 'water'
  | 'fire'
  | 'ice_column'
  | 'updraft'
  | 'suction';

export interface CharacterSpec {
  id: CharacterId;
  name: string;
  role: string;
  bio: string;
  powerName: string;
  powerDescription: string;
  fluidCost: number;
  powerDuration: number;
  cooldown: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  speedMultiplier: number;
  jumpMultiplier: number;
  unlockHint: string;
}

export interface Platform {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'ground' | 'floating' | 'moving' | 'bounce' | 'breakable';
  surface?: SurfaceType;
  oneWay?: boolean;
  moveAxis?: 'y';
  moveRange?: number;
  moveSpeed?: number;
  phaseOffset?: number;
  baseX: number;
  baseY: number;
  dx: number;
  dy: number;
  broken?: boolean;
  bounceCompression?: number;
}

export interface HazardZone {
  id: string;
  type: HazardType;
  x: number;
  y: number;
  w: number;
  h: number;
  pulsing?: boolean;
  cyclePeriod?: number;
  phaseOffset?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  isSprinkler?: boolean;
}

export interface RopeVine {
  id: string;
  x: number;
  anchorY: number;
  length: number;
  kind: 'vine' | 'cable';
}

export interface RopeNode {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
}

export interface RopeState extends RopeVine {
  nodes: RopeNode[];
}

export interface WindZone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  forceX: number;
  forceY?: number;
}

export interface FluidBottle {
  id: string;
  x: number;
  y: number;
  collected: boolean;
  bobPhase: number;
}

export interface HeartPickup {
  id: string;
  x: number;
  y: number;
  collected: boolean;
  bobPhase: number;
}

export interface BrakePart {
  id: string;
  x: number;
  y: number;
  partType: BrakePartType;
  label: string;
  collected: boolean;
  bobPhase: number;
}

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  baseVx: number;
  vy: number;
  patrolMinX: number;
  patrolMaxX: number;
  baseY: number;
  facing: 1 | -1;
  alive: boolean;
  animTime: number;
  stunTimer: number;
  aiState: 'patrol' | 'telegraph' | 'attack' | 'cooldown';
  aiTimer: number;
  attackCooldown: number;
}

export interface EnemyProjectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: 'booze' | 'minicone' | 'oil';
  rot: number;
  life: number;
}

export interface BossProjectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: 'blade' | 'spark' | 'bottle' | 'gear';
  rot: number;
  life: number;
}

export type CharacterExpression =
  | 'normal'
  | 'jump'
  | 'fall'
  | 'crouch'
  | 'power'
  | 'hurt'
  | 'celebrate'
  | 'idle'
  | 'frozen';

export interface BossState {
  active: boolean;
  id: BossId;
  name: string;
  subtitle: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  state: 'idle' | 'telegraph' | 'attack' | 'recover' | 'hurt' | 'transform';
  stateTimer: number;
  attackPattern: number;
  invulnTimer: number;
  animTime: number;
  headFireActive: boolean;
  unlocksCharacter: CharacterId;
  isFinalBoss: boolean;
  phase: 1 | 2;
  transformTimer: number;
  speechText: string | null;
  speechTimer: number;
  speechCooldown: number;
}

export interface ChalkConstruct {
  id: string;
  kind: 'bridge' | 'wall';
  x: number;
  y: number;
  w: number;
  h: number;
  timer: number;
  maxTimer: number;
  color: string;
}

export interface SonicWave {
  id: string;
  x: number;
  y: number;
  vx: number;
  radius: number;
  life: number;
  maxLife: number;
  hue: number;
  phase: number;
}

export interface DogCompanion {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  facing: 1 | -1;
  timer: number;
  maxTimer: number;
  attackCooldown: number;
  lungeTimer: number;
  animTime: number;
}

export interface RewindSample {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  timestamp: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  shape: 'circle' | 'star' | 'drop' | 'note' | 'spark' | 'ring';
  rotation: number;
  rotSpeed: number;
  gravity: number;
}

export interface PopBurst {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface LevelPalette {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  horizonFog: string;
  buildingFar: string;
  buildingMid: string;
  platformTop: string;
  platformBody: string;
  platformStripe: string;
  theme: 'neighborhood' | 'avenue' | 'viaduct' | 'workshop_road';
  timeOfDay: TimeOfDay;
  season: SeasonType;
  ambientTint?: string;
}

export interface LevelDefinition {
  index: number;
  chapter: number;
  title: string;
  subtitle: string;
  storyNote: string;
  width: number;
  height: number;
  spawnX: number;
  spawnY: number;
  goalX: number;
  goalY: number;
  isBossArena: boolean;
  bossId?: BossId;
  unlocksCharacter?: CharacterId;
  isFinalWorkshop: boolean;
  palette: LevelPalette;
  platforms: Omit<Platform, 'baseX' | 'baseY' | 'dx' | 'dy'>[];
  hazards: HazardZone[];
  ropes?: RopeVine[];
  windZones?: WindZone[];
  ambientWindX?: number;
  bottles: Omit<FluidBottle, 'collected' | 'bobPhase'>[];
  hearts?: Omit<HeartPickup, 'collected' | 'bobPhase'>[];
  parts: Omit<BrakePart, 'collected' | 'bobPhase'>[];
  enemies: Omit<
    Enemy,
    | 'alive'
    | 'animTime'
    | 'stunTimer'
    | 'vy'
    | 'baseY'
    | 'baseVx'
    | 'aiState'
    | 'aiTimer'
    | 'attackCooldown'
  >[];
}

export interface PlayerState {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  groundSurface: SurfaceType;
  coyoteTimer: number;
  jumpBufferTimer: number;
  invulnTimer: number;
  hurtAnimTimer: number;
  celebrateTimer: number;
  fluid: number;
  maxFluid: number;
  powerTimer: number;
  powerCooldown: number;
  powerMaxCooldown: number;
  guitarShootTimer: number;
  dashDir: 1 | -1;
  squashX: number;
  squashY: number;
  walkCycle: number;
  idleTime: number;
  isCrouching: boolean;
  dropThroughTimer: number;
  isSleepingInBed: boolean;
  isIdleScene: boolean;
  idleClientChar: CharacterId;
  grabbedRopeId: string | null;
  ropeAngle: number;
  ropeAngularVel: number;
  ropeDist: number;
  ropeCooldown: number;
  carRewindTimer: number;
  carRewindDuration: number;
  carRewindPath: RewindSample[];
  lastSafeX: number;
  lastSafeY: number;
  frozenTimer: number;
  frozenMaxTimer: number;
  frozenCooldown: number;
  frozenShakeCount: number;
  updraftLaunched: boolean;
  fallPeakY: number;
}

export interface CinematicState {
  active: boolean;
  elapsed: number;
  duration: number;
  liftProgress: number;
  fadeBlack: number;
  caption: string;
  showTheEnd: boolean;
}

export interface HudSnapshot {
  phase: GamePhase;
  characterId: CharacterId;
  unlockedCharacters: CharacterId[];
  newlyUnlockedCharacter: CharacterId | null;
  levelIndex: number;
  totalLevels: number;
  levelTitle: string;
  levelSubtitle: string;
  storyNote: string;
  lives: number;
  maxLives: number;
  fluid: number;
  maxFluid: number;
  partsCollected: number;
  partsTotal: number;
  isBossArena: boolean;
  bossDefeated: boolean;
  bossName: string | null;
  bossSubtitle: string | null;
  bossHp: number;
  bossMaxHp: number;
  powerActive: boolean;
  powerTimer: number;
  powerDuration: number;
  powerCooldown: number;
  powerMaxCooldown: number;
  bottlesCollected: number;
  enemiesDefeated: number;
  score: number;
  muted: boolean;
  musicVolume: number;
  powerFeedback: string | null;
  cinematicCaption: string | null;
  showTheEnd: boolean;
  gameCompleted: boolean;
  swapsRemaining: number;
  ambientWindX: number;
}
