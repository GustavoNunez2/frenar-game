import {
  ArrowRight,
  Disc3,
  Heart,
  Minus,
  Music,
  Pause,
  Plus,
  RotateCcw,
  Skull,
  Users,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import { CHARACTERS } from '../game/characters';
import { HudSnapshot } from '../game/types';
import { CharacterPortrait } from './CharacterPortrait';
import { FrenarLogo } from './FrenarLogo';

interface GameHUDProps {
  hud: HudSnapshot;
  onTriggerPower: () => void;
  onOpenCharacterSelect: () => void;
  onRestartLevel: () => void;
  onNextLevel: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onSetMusicVolume: (percent: number) => void;
  onStepMusicVolume: (delta: number) => void;
}

/**
 * Interfaz superior del juego FRENAR®: logo oficial, medidor de Líquido de Freno,
 * repuestos o barra de jefe, botón directo de avance post-jefe y controles rápidos.
 */
export function GameHUD({
  hud,
  onTriggerPower,
  onOpenCharacterSelect,
  onRestartLevel,
  onNextLevel,
  onTogglePause,
  onToggleMute,
  onSetMusicVolume,
  onStepMusicVolume,
}: GameHUDProps) {
  if (
    hud.phase === 'CINEMATIC' ||
    hud.phase === 'FINAL_BOSS_SELECT' ||
    hud.phase === 'CHARACTER_SELECT'
  ) {
    return null;
  }

  const charSpec = CHARACTERS[hud.characterId];
  const fluidPct = Math.max(0, Math.min(100, (hud.fluid / hud.maxFluid) * 100));
  const hasEnoughFluid = hud.fluid >= charSpec.fluidCost;
  const onCooldown = hud.powerCooldown > 0.05;
  const canUsePower = hasEnoughFluid && !onCooldown;
  const canSwap = hud.swapsRemaining > 0 || hud.bossDefeated;
  const bossPct =
    hud.bossMaxHp > 0 ? Math.max(0, (hud.bossHp / hud.bossMaxHp) * 100) : 0;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 px-4 pt-3">
      <div className="pointer-events-auto mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 rounded-2xl border-[3px] border-[#110B1E] bg-[#1A0B33]/92 px-4 py-2 shadow-[0_6px_0_#110B1E] backdrop-blur-md">
        {/* Zona 1: Logo FRENAR® + Personaje activo */}
        <div className="flex items-center gap-3">
          <div className="hidden xl:block pr-1">
            <FrenarLogo size="sm" />
          </div>
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border-2 border-[#110B1E] bg-[#2D1458]">
            <CharacterPortrait
              characterId={hud.characterId}
              size={50}
              animateWalk={false}
              powerPreview={hud.powerActive}
            />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="font-display text-base tracking-wide text-[#FFE600]">
                {charSpec.name}
              </span>
              <span className="text-xs text-purple-200/80">·</span>
              <span className="text-xs font-medium text-cyan-300">
                Nivel {hud.levelIndex + 1}/{hud.totalLevels}
              </span>
            </div>
            <p
              className="max-w-[245px] truncate text-xs text-purple-200/90"
              title={`${hud.levelTitle} — ${hud.levelSubtitle}`}
            >
              {hud.levelTitle} · {hud.levelSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCharacterSelect}
            disabled={!canSwap}
            className={`ml-1 flex items-center gap-1.5 rounded-lg border-2 border-[#110B1E] px-2.5 py-1.5 text-xs font-semibold transition-transform whitespace-nowrap shrink-0 ${
              canSwap
                ? 'bg-[#3B1D6E] text-white hover:bg-[#4F2892] active:translate-y-0.5 cursor-pointer'
                : 'bg-[#221142] text-purple-300/55 cursor-not-allowed'
            }`}
            title={
              hud.bossDefeated
                ? 'Cambiar de personaje libremente'
                : canSwap
                  ? 'Cambiar de personaje (1 cambio por pantalla)'
                  : 'Cambio usado en esta pantalla (0/1)'
            }
          >
            <Users className={`h-3.5 w-3.5 ${canSwap ? 'text-[#00E5FF]' : 'text-purple-400/50'}`} />
            <span>
              {hud.bossDefeated
                ? 'Cambiar'
                : canSwap
                  ? 'Cambiar (1/1)'
                  : 'Usado (0/1)'}
            </span>
          </button>
          {hud.ambientWindX !== 0 && (
            <div
              className="flex items-center gap-1 rounded-lg border border-sky-400/40 bg-sky-950/70 px-2 py-1 text-[11px] font-bold text-sky-200 whitespace-nowrap"
              title="Viento con empuje real en esta pantalla"
            >
              <Wind className="h-3.5 w-3.5 text-sky-300" />
              <span>{hud.ambientWindX > 0 ? 'Viento ►' : 'Viento ◄'}</span>
            </div>
          )}
        </div>

        {/* Zona 2: Tubo de Líquido de Freno + Repuestos/Jefe/Avance + Vidas */}
        <div className="flex flex-1 flex-wrap items-center justify-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="text-right leading-tight">
              <div className="text-[11px] font-bold tracking-wide text-amber-300">
                LÍQUIDO DE FRENO
              </div>
              <div className="font-mono-hud text-sm font-bold text-white">
                {hud.fluid}/{hud.maxFluid}
              </div>
            </div>

            <div
              className="relative h-7 w-40 overflow-hidden rounded-full border-[3px] border-[#110B1E] bg-[#120722] shadow-inner"
              role="progressbar"
              aria-valuenow={hud.fluid}
              aria-valuemin={0}
              aria-valuemax={hud.maxFluid}
              aria-label="Medidor de líquido de freno"
            >
              <div
                className="relative h-full transition-[width] duration-200 ease-out"
                style={{
                  width: `${fluidPct}%`,
                  background:
                    'linear-gradient(90deg, #FF2A00 0%, #FF7B00 55%, #FFD000 100%)',
                }}
              >
                <svg
                  className="animate-liquid-wave absolute -top-1.5 left-0 h-3 w-[200%] opacity-85"
                  viewBox="0 0 120 12"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0 6 Q 15 0, 30 6 T 60 6 T 90 6 T 120 6 L 120 12 L 0 12 Z"
                    fill="#FFE600"
                  />
                </svg>
                <span className="animate-bubble-1 absolute bottom-1 left-[22%] h-2 w-2 rounded-full bg-yellow-100/80" />
                <span className="animate-bubble-2 absolute bottom-1 left-[54%] h-1.5 w-1.5 rounded-full bg-white/85" />
                <span className="animate-bubble-3 absolute bottom-1 left-[78%] h-2 w-2 rounded-full bg-amber-100/80" />
              </div>
              <div className="pointer-events-none absolute inset-0 flex justify-evenly">
                <span className="h-2.5 w-[2px] bg-white/35" />
                <span className="h-3.5 w-[2px] bg-white/45" />
                <span className="h-2.5 w-[2px] bg-white/35" />
              </div>
            </div>
          </div>

          {hud.isBossArena && hud.bossDefeated ? (
            <button
              type="button"
              onClick={onNextLevel}
              className="flex items-center gap-2 rounded-xl border-[2.5px] border-[#110B1E] bg-[#7CFF00] px-3.5 py-1.5 text-xs font-bold text-[#110B1E] shadow-[0_3px_0_#110B1E] hover:bg-[#96FF33] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Siguiente capítulo</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : hud.isBossArena && hud.bossName ? (
            <div className="flex items-center gap-2.5 rounded-xl border-2 border-[#110B1E] bg-[#310C23] px-3 py-1.5">
              <Skull className="h-5 w-5 text-[#FF3B6B]" />
              <div className="w-36 leading-tight">
                <div className="flex items-center justify-between text-[11px] font-bold text-rose-200">
                  <span className="truncate">{hud.bossName}</span>
                  <span className="font-mono-hud ml-1">
                    {hud.bossHp}/{hud.bossMaxHp}
                  </span>
                </div>
                <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-[#180612]">
                  <div
                    className="h-full bg-gradient-to-r from-[#EF4444] to-[#FACC15] transition-[width] duration-200"
                    style={{ width: `${bossPct}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border-2 border-[#110B1E] bg-[#28124D] px-3 py-1.5">
              <Disc3
                className={`h-5 w-5 ${
                  hud.partsCollected >= hud.partsTotal
                    ? 'animate-spin text-[#7CFF00]'
                    : 'text-[#00E5FF]'
                }`}
              />
              <div className="leading-tight">
                <div className="text-[10px] font-semibold text-purple-200/80">
                  Repuestos
                </div>
                <div className="font-mono-hud text-sm font-bold text-white">
                  {hud.partsCollected}/{hud.partsTotal}
                </div>
              </div>
            </div>
          )}

          {/* Vidas */}
          <div className="flex items-center gap-1" aria-label={`Vidas: ${hud.lives}`}>
            {Array.from({ length: hud.maxLives }).map((_, idx) => (
              <Heart
                key={idx}
                className={`h-5 w-5 transition-transform ${
                  idx < hud.lives
                    ? 'fill-[#FF2D87] text-[#110B1E] scale-100'
                    : 'fill-purple-950/60 text-purple-900 scale-90'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Zona 3: Botón Poder + Acciones rápidas */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTriggerPower}
            disabled={!canUsePower && !hud.powerActive}
            className={`flex items-center gap-2 rounded-xl border-[2.5px] border-[#110B1E] px-3.5 py-1.5 text-xs font-bold transition-transform whitespace-nowrap shrink-0 cursor-pointer ${
              hud.powerActive
                ? 'bg-[#7CFF00] text-[#110B1E] shadow-[0_3px_0_#110B1E]'
                : canUsePower
                  ? 'bg-[#FFE600] text-[#110B1E] hover:bg-[#FFF04D] active:translate-y-0.5 shadow-[0_3px_0_#110B1E]'
                  : 'bg-[#2C184D] text-purple-300/60 cursor-not-allowed'
            }`}
            title={`${charSpec.powerName} (Costo: ${charSpec.fluidCost} líquido) — Tecla E o Shift`}
          >
            <Zap className="h-4 w-4" />
            <span>
              {hud.powerActive
                ? `Activo ${hud.powerTimer.toFixed(1)}s`
                : onCooldown
                  ? `Espera ${hud.powerCooldown.toFixed(1)}s`
                  : `${charSpec.powerName} (${charSpec.fluidCost})`}
            </span>
          </button>

          <button
            type="button"
            onClick={onRestartLevel}
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#110B1E] bg-[#2D1458] text-white transition-colors hover:bg-[#42207C] cursor-pointer"
            title="Reiniciar nivel (R)"
            aria-label="Reiniciar nivel"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onTogglePause}
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#110B1E] bg-[#2D1458] text-white transition-colors hover:bg-[#42207C] cursor-pointer"
            title="Pausa (P o Esc)"
            aria-label="Pausar juego"
          >
            <Pause className="h-4 w-4" />
          </button>

          <div
            className="hidden sm:flex items-center gap-1.5 rounded-xl border-2 border-[#110B1E] bg-[#241047] px-2 py-1"
            title="Volumen música Cuarteto (- / +)"
          >
            <Music className="h-3.5 w-3.5 text-[#FFE600] shrink-0" />
            <button
              type="button"
              onClick={() => onStepMusicVolume(-0.1)}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-[#3B1D6E] text-white hover:bg-[#4F2892] cursor-pointer"
              title="Bajar volumen música (-)"
              aria-label="Bajar volumen música"
            >
              <Minus className="h-3 w-3" />
            </button>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={hud.muted ? 0 : hud.musicVolume}
              onChange={(e) => onSetMusicVolume(Number(e.target.value))}
              className="h-1.5 w-14 cursor-pointer accent-[#FFE600]"
              aria-label="Volumen de música Cuarteto"
            />
            <button
              type="button"
              onClick={() => onStepMusicVolume(0.1)}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-[#3B1D6E] text-white hover:bg-[#4F2892] cursor-pointer"
              title="Subir volumen música (+)"
              aria-label="Subir volumen música"
            >
              <Plus className="h-3 w-3" />
            </button>
            <span className="font-mono-hud w-8 text-right text-[10px] font-bold text-amber-200">
              {hud.muted ? '0%' : `${hud.musicVolume}%`}
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#110B1E] bg-[#2D1458] text-white transition-colors hover:bg-[#42207C] cursor-pointer"
            title={hud.muted ? 'Activar sonido (M)' : 'Silenciar (M)'}
            aria-label={hud.muted ? 'Activar sonido' : 'Silenciar sonido'}
          >
            {hud.muted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-[#7CFF00]" />
            )}
          </button>
        </div>
      </div>

      {hud.powerFeedback && (
        <div className="mt-2 flex justify-center">
          <div className="rounded-xl border-2 border-[#110B1E] bg-[#FFE600] px-4 py-1 text-xs font-bold text-[#110B1E] shadow-[0_3px_0_#110B1E]">
            {hud.powerFeedback}
          </div>
        </div>
      )}
    </header>
  );
}
