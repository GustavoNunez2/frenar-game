import {
  ArrowRight,
  Minus,
  Music,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import { CHARACTERS } from '../game/characters';
import { HudSnapshot } from '../game/types';
import { CharacterPortrait } from './CharacterPortrait';
import { FrenarLogo } from './FrenarLogo';

interface GameOverlaysProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestartLevel: () => void;
  onNextLevel: () => void;
  onPlayAgain: () => void;
  onOpenCharacterSelect: () => void;
  onSetMusicVolume: (percent: number) => void;
  onStepMusicVolume: (delta: number) => void;
  onToggleMute: () => void;
}

/**
 * Pantallas modales para Pausa, Nivel Completado, Jefe Derrotado (+ Nuevo Héroe),
 * Subtítulos de Cinemática Final, Game Over y Victoria en el Taller FRENAR.
 */
export function GameOverlays({
  hud,
  onResume,
  onRestartLevel,
  onNextLevel,
  onPlayAgain,
  onOpenCharacterSelect,
  onSetMusicVolume,
  onStepMusicVolume,
  onToggleMute,
}: GameOverlaysProps) {
  if (
    hud.phase === 'PLAYING' ||
    hud.phase === 'CHARACTER_SELECT' ||
    hud.phase === 'FINAL_BOSS_SELECT'
  ) {
    return null;
  }

  if (hud.phase === 'CINEMATIC') {
    if (!hud.cinematicCaption) return null;
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center px-4">
        <div className="rounded-2xl border-2 border-[#110B1E] bg-[#14082A]/90 px-6 py-2.5 text-center text-sm font-semibold text-[#FFE600] shadow-[0_6px_0_#110B1E] backdrop-blur-sm">
          {hud.cinematicCaption}
        </div>
      </div>
    );
  }

  const charSpec = CHARACTERS[hud.characterId];
  const canSwap = hud.swapsRemaining > 0 || hud.bossDefeated;
  const unlockedSpec = hud.newlyUnlockedCharacter
    ? CHARACTERS[hud.newlyUnlockedCharacter]
    : null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0F0520]/82 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border-[4px] border-[#110B1E] bg-[#210D44] p-7 text-center shadow-[0_12px_0_#110B1E]">
        {hud.phase === 'PAUSED' && (
          <>
            <h2 className="font-display text-3xl text-[#FFE600]">JUEGO EN PAUSA</h2>
            <p className="mt-2 text-sm text-purple-200">
              {hud.levelTitle} · Jugando con {charSpec.name}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={onResume}
                className="flex items-center justify-center gap-2 rounded-xl border-[3px] border-[#110B1E] bg-[#7CFF00] px-5 py-3 text-sm font-bold text-[#110B1E] shadow-[0_4px_0_#110B1E] hover:bg-[#96FF33] cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                Continuar partida
              </button>
              <button
                type="button"
                onClick={onOpenCharacterSelect}
                disabled={!canSwap}
                className={`flex items-center justify-center gap-2 rounded-xl border-[3px] border-[#110B1E] px-5 py-3 text-sm font-bold shadow-[0_4px_0_#110B1E] ${
                  canSwap
                    ? 'bg-[#00E5FF] text-[#110B1E] hover:bg-[#4DF0FF] cursor-pointer'
                    : 'bg-[#2C184D] text-purple-300/60 cursor-not-allowed'
                }`}
              >
                <Users className="h-4 w-4" />
                {canSwap
                  ? 'Cambiar de personaje (1/1 disponible)'
                  : 'Cambio usado en esta pantalla (0/1)'}
              </button>
              <button
                type="button"
                onClick={onRestartLevel}
                className="flex items-center justify-center gap-2 rounded-xl border-[3px] border-[#110B1E] bg-[#3A1B6E] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_0_#110B1E] hover:bg-[#4E2792] cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                Reiniciar nivel actual
              </button>
              <div className="mt-1 flex items-center justify-between gap-2 rounded-xl border-2 border-[#110B1E] bg-[#160830] px-3.5 py-2.5 text-xs text-purple-100">
                <span className="flex items-center gap-1.5 font-bold text-[#FFE600]">
                  <Music className="h-4 w-4" />
                  Música Cuarteto
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onStepMusicVolume(-0.1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#110B1E] bg-[#3A1B6E] text-white hover:bg-[#4E2792] cursor-pointer"
                    title="Bajar volumen (-)"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={hud.muted ? 0 : hud.musicVolume}
                    onChange={(e) => onSetMusicVolume(Number(e.target.value))}
                    className="h-1.5 w-24 cursor-pointer accent-[#FFE600]"
                    aria-label="Volumen de música Cuarteto"
                  />
                  <button
                    type="button"
                    onClick={() => onStepMusicVolume(0.1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#110B1E] bg-[#3A1B6E] text-white hover:bg-[#4E2792] cursor-pointer"
                    title="Subir volumen (+)"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-mono-hud w-9 text-right font-bold text-amber-200">
                    {hud.muted ? '0%' : `${hud.musicVolume}%`}
                  </span>
                  <button
                    type="button"
                    onClick={onToggleMute}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#110B1E] bg-[#2D1458] text-white hover:bg-[#42207C] cursor-pointer"
                    title={hud.muted ? 'Activar sonido (M)' : 'Silenciar (M)'}
                  >
                    {hud.muted ? (
                      <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5 text-[#7CFF00]" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {hud.phase === 'LEVEL_COMPLETE' && (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border-[3px] border-[#110B1E] bg-[#2E165C]">
              <CharacterPortrait
                characterId={hud.characterId}
                size={76}
                animateWalk={true}
              />
            </div>
            <h2 className="font-display mt-4 text-3xl text-[#7CFF00]">
              ¡PANTALLA SUPERADA!
            </h2>
            <p className="mt-1.5 text-sm text-purple-100">
              {charSpec.name} reunió los {hud.partsTotal} repuestos de{' '}
              <strong>{hud.levelTitle}</strong>.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border-2 border-[#110B1E] bg-[#160830] p-4 text-xs">
              <div>
                <div className="text-purple-300">Puntaje</div>
                <div className="font-mono-hud mt-0.5 text-lg font-bold text-[#FFE600]">
                  {hud.score}
                </div>
              </div>
              <div>
                <div className="text-purple-300">Botellitas</div>
                <div className="font-mono-hud mt-0.5 text-lg font-bold text-amber-400">
                  {hud.bottlesCollected}
                </div>
              </div>
              <div>
                <div className="text-purple-300">Enemigos</div>
                <div className="font-mono-hud mt-0.5 text-lg font-bold text-[#00E5FF]">
                  {hud.enemiesDefeated}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onOpenCharacterSelect}
                disabled={!canSwap}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-[3px] border-[#110B1E] px-4 py-3 text-sm font-bold shadow-[0_4px_0_#110B1E] ${
                  canSwap
                    ? 'bg-[#3A1B6E] text-white hover:bg-[#4E2792] cursor-pointer'
                    : 'bg-[#231042] text-purple-300/60 cursor-not-allowed'
                }`}
              >
                <Users className="h-4 w-4" />
                {canSwap ? 'Cambiar héroe (1/1)' : 'Cambio usado (0/1)'}
              </button>
              <button
                type="button"
                onClick={onNextLevel}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-[3px] border-[#110B1E] bg-[#FFE600] px-4 py-3 text-sm font-bold text-[#110B1E] shadow-[0_4px_0_#110B1E] hover:bg-[#FFF04D] cursor-pointer"
              >
                Siguiente pantalla
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {hud.phase === 'BOSS_VICTORY' && unlockedSpec && (
          <>
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl border-[3px] border-[#FFE600] bg-[#2E165C] shadow-[0_0_24px_rgba(255,230,0,0.45)]">
              <CharacterPortrait
                characterId={unlockedSpec.id}
                size={84}
                animateWalk={true}
                powerPreview={true}
              />
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#00E5FF]">
              <Sparkles className="h-4 w-4 text-[#FFE600]" />
              ¡JEFE DERROTADO · NUEVO PERSONAJE DESBLOQUEADO!
            </p>
            <h2 className="font-display mt-1 text-3xl text-[#FFE600]">
              ¡{unlockedSpec.name.toUpperCase()} SE UNE AL EQUIPO!
            </h2>
            <p className="mt-2 text-sm text-purple-100">
              {unlockedSpec.role} · <strong>{unlockedSpec.powerName}</strong>:{' '}
              {unlockedSpec.powerDescription}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onOpenCharacterSelect}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-[3px] border-[#110B1E] bg-[#00E5FF] px-4 py-3 text-sm font-bold text-[#110B1E] shadow-[0_4px_0_#110B1E] hover:bg-[#4DF0FF] cursor-pointer"
              >
                <Users className="h-4 w-4" />
                Probar a {unlockedSpec.name}
              </button>
              <button
                type="button"
                onClick={onNextLevel}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-[3px] border-[#110B1E] bg-[#7CFF00] px-4 py-3 text-sm font-bold text-[#110B1E] shadow-[0_4px_0_#110B1E] hover:bg-[#96FF33] cursor-pointer"
              >
                Siguiente capítulo
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {hud.phase === 'GAME_OVER' && (
          <>
            <h2 className="font-display text-3xl text-[#FF2D87]">
              ¡SIN VIDAS EN LA RUTA!
            </h2>
            <p className="mt-2 text-sm text-purple-100">
              Las calles y sus obstáculos frenaron a {charSpec.name} en{' '}
              <strong>{hud.levelTitle}</strong>.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={onRestartLevel}
                className="flex items-center justify-center gap-2 rounded-xl border-[3px] border-[#110B1E] bg-[#FFE600] px-5 py-3 text-sm font-bold text-[#110B1E] shadow-[0_4px_0_#110B1E] hover:bg-[#FFF04D] cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                Reintentar este nivel
              </button>
              <button
                type="button"
                onClick={onOpenCharacterSelect}
                className="flex items-center justify-center gap-2 rounded-xl border-[3px] border-[#110B1E] bg-[#00E5FF] px-5 py-3 text-sm font-bold text-[#110B1E] shadow-[0_4px_0_#110B1E] hover:bg-[#4DF0FF] cursor-pointer"
              >
                <Users className="h-4 w-4" />
                Elegir otro personaje
              </button>
            </div>
          </>
        )}

        {hud.phase === 'VICTORY' && (
          <>
            <div className="mx-auto flex justify-center">
              <FrenarLogo size="md" />
            </div>
            <div className="mx-auto mt-3 flex h-14 w-14 items-center justify-center rounded-2xl border-[3px] border-[#110B1E] bg-[#FFE600] text-[#110B1E]">
              <Trophy className="h-8 w-8" />
            </div>
            <h2 className="font-display mt-3 text-2xl text-[#7CFF00]">
              ¡THE END · FRENOS REPARADOS!
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-purple-100">
              ¡Misión cumplida! Todos los 6 personajes trabajaron juntos en el taller{' '}
              <strong className="text-[#FFE600]">FRENAR®</strong> para dejar el auto frenando a la
              perfección. Los 6 héroes quedan desbloqueados para siempre.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border-2 border-[#110B1E] bg-[#160830] p-4 text-xs">
              <div>
                <div className="text-purple-300">Puntaje Final</div>
                <div className="font-mono-hud mt-0.5 text-lg font-bold text-[#FFE600]">
                  {hud.score}
                </div>
              </div>
              <div>
                <div className="text-purple-300">Líquido Junta</div>
                <div className="font-mono-hud mt-0.5 text-lg font-bold text-amber-400">
                  {hud.bottlesCollected}
                </div>
              </div>
              <div>
                <div className="text-purple-300">Derrotados</div>
                <div className="font-mono-hud mt-0.5 text-lg font-bold text-[#00E5FF]">
                  {hud.enemiesDefeated}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onOpenCharacterSelect}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-[3px] border-[#110B1E] bg-[#00E5FF] px-4 py-3 text-sm font-bold text-[#110B1E] shadow-[0_4px_0_#110B1E] hover:bg-[#4DF0FF] cursor-pointer"
              >
                <Wrench className="h-4 w-4" />
                Ver equipo completo
              </button>
              <button
                type="button"
                onClick={onPlayAgain}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-[3px] border-[#110B1E] bg-[#FFE600] px-4 py-3 text-sm font-bold text-[#110B1E] shadow-[0_4px_0_#110B1E] hover:bg-[#FFF04D] cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                Jugar de nuevo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
