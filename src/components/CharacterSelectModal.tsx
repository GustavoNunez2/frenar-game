import {
  ArrowRight,
  CheckCircle2,
  Droplets,
  Keyboard,
  Lock,
  Minus,
  Music,
  Plus,
  RotateCcw,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CHARACTER_LIST } from '../game/characters';
import { CharacterId } from '../game/types';
import { CharacterPortrait } from './CharacterPortrait';
import { FrenarLogo } from './FrenarLogo';

interface CharacterSelectModalProps {
  selectedId: CharacterId;
  unlockedCharacters: CharacterId[];
  inProgress: boolean;
  isFinalBossSelect?: boolean;
  gameCompleted?: boolean;
  swapsRemaining?: number;
  musicVolume?: number;
  muted?: boolean;
  onSelectCharacter: (id: CharacterId) => void;
  onResume?: () => void;
  onResetProgress?: () => void;
  onSetMusicVolume?: (percent: number) => void;
  onStepMusicVolume?: (delta: number) => void;
  onToggleMute?: () => void;
}

/**
 * Pantalla de selección de los 6 personajes con desbloqueo progresivo cada 3 pantallas,
 * desbloqueo permanente tras completar el juego y selector previo al Monstruo Final en FRENAR.
 */
export function CharacterSelectModal({
  selectedId,
  unlockedCharacters,
  inProgress,
  isFinalBossSelect = false,
  gameCompleted = false,
  swapsRemaining = 1,
  musicVolume = 65,
  muted = false,
  onSelectCharacter,
  onResume,
  onResetProgress,
  onSetMusicVolume,
  onStepMusicVolume,
  onToggleMute,
}: CharacterSelectModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0C071A]/88 p-4 backdrop-blur-md overflow-y-auto">
      <div className="my-auto w-full max-w-6xl rounded-3xl border-[4px] border-[#110B1E] bg-[#1E0C3D] p-6 shadow-[0_12px_0_#110B1E] md:p-8">
        {/* Encabezado */}
        <div className="flex flex-col justify-between gap-4 border-b-2 border-purple-700/50 pb-5 md:flex-row md:items-end">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-[#00E5FF]">
              {isFinalBossSelect && <Swords className="h-4 w-4 text-[#FFE600]" />}
              {isFinalBossSelect
                ? '¡Último obstáculo en la puerta del taller FRENAR®!'
                : '12 Pantallas Urbanas · 4 Jefes · Desbloquea héroes cada 3 pantallas'}
            </p>
            <div className="mt-1.5">
              <FrenarLogo size="lg" />
            </div>
            {isFinalBossSelect && (
              <h1 className="font-display mt-2 text-xl tracking-wide text-[#FFE600] md:text-2xl">
                ELIGE TU HÉROE PARA EL MONSTRUO FINAL
              </h1>
            )}
            <p className="mt-1.5 max-w-2xl text-sm text-purple-100/90">
              {isFinalBossSelect
                ? '¡Un Cliente Molesto de 2 fases bloquea el portón de FRENAR®! Elige con qué héroe de tu equipo enfrentarlo para entrar al taller y reparar el auto.'
                : gameCompleted
                  ? '¡Ya completaste la ruta a FRENAR®! Los 6 héroes están desbloqueados de forma permanente para jugar desde el inicio.'
                  : 'Comienzas con Rodolfo y Marcela disponibles. Supera cada capítulo de 3 pantallas y derrota a su jefe para sumar nuevos personajes.'}
            </p>
            {inProgress && !isFinalBossSelect && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-cyan-400/45 bg-cyan-950/60 px-2.5 py-1 text-xs font-semibold text-cyan-200">
                <span>
                  Cambio en esta pantalla:{' '}
                  <strong className="text-[#FFE600]">
                    {swapsRemaining > 0 ? '1/1 disponible' : '0/1 (usado)'}
                  </strong>{' '}
                  · Elegir otro personaje consume el cambio de la pantalla
                </span>
              </div>
            )}
            {gameCompleted && !isFinalBossSelect && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-950/60 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Juego completado · 6 héroes desbloqueados
                </span>
                {onResetProgress && (
                  <button
                    type="button"
                    onClick={onResetProgress}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-400/40 bg-[#14072A] px-2.5 py-1 text-xs font-semibold text-purple-200 transition-colors hover:border-[#FFE600] hover:text-[#FFE600] cursor-pointer"
                    title="Volver a bloquear personajes para rejugar el desbloqueo progresivo"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reiniciar progreso
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-start gap-2 rounded-2xl border-2 border-[#110B1E] bg-[#14072A] px-4 py-3 text-xs text-purple-100 md:items-end">
            <div className="flex items-center gap-2 font-bold text-[#FFE600]">
              <Keyboard className="h-4 w-4" />
              <span>Controles de PC</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-purple-200">
              <span>
                <strong className="text-white">A / D</strong> o{' '}
                <strong className="text-white">← / →</strong> Moverse
              </span>
              <span>·</span>
              <span>
                <strong className="text-white">S / ↓</strong> Agacharse
              </span>
              <span>·</span>
              <span>
                <strong className="text-white">W / Espacio / ↑</strong> Saltar
              </span>
              <span>·</span>
              <span>
                <strong className="text-[#00E5FF]">E / Shift</strong> Poder
              </span>
            </div>
            {onSetMusicVolume && onStepMusicVolume && onToggleMute && (
              <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-purple-800/60 pt-2">
                <span className="flex items-center gap-1 font-bold text-[#FFE600]">
                  <Music className="h-3.5 w-3.5" />
                  Cuarteto:
                </span>
                <button
                  type="button"
                  onClick={() => onStepMusicVolume(-0.1)}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-[#110B1E] bg-[#2D1458] text-white hover:bg-[#452184] cursor-pointer"
                  title="Bajar volumen (-)"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={muted ? 0 : musicVolume}
                  onChange={(e) => onSetMusicVolume(Number(e.target.value))}
                  className="h-1.5 w-20 cursor-pointer accent-[#FFE600]"
                  aria-label="Volumen de música Cuarteto"
                />
                <button
                  type="button"
                  onClick={() => onStepMusicVolume(0.1)}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-[#110B1E] bg-[#2D1458] text-white hover:bg-[#452184] cursor-pointer"
                  title="Subir volumen (+)"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <span className="font-mono-hud w-8 text-right font-bold text-amber-200">
                  {muted ? '0%' : `${musicVolume}%`}
                </span>
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-[#110B1E] bg-[#2D1458] text-white hover:bg-[#452184] cursor-pointer"
                  title={muted ? 'Activar sonido (M)' : 'Silenciar (M)'}
                >
                  {muted ? (
                    <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5 text-[#7CFF00]" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Grilla de 6 Personajes */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHARACTER_LIST.map((char) => {
            const isUnlocked = unlockedCharacters.includes(char.id);
            const isSelected = char.id === selectedId && isUnlocked;

            return (
              <button
                key={char.id}
                type="button"
                disabled={!isUnlocked}
                onClick={() => isUnlocked && onSelectCharacter(char.id)}
                className={`group flex flex-col justify-between rounded-2xl border-[3px] p-4 text-left transition-transform duration-150 ${
                  !isUnlocked
                    ? 'border-[#110B1E] bg-[#140A2B]/80 opacity-65 cursor-not-allowed'
                    : isSelected
                      ? 'border-[#FFE600] bg-[#2D145B] shadow-[0_6px_0_#FFE600] hover:-translate-y-1 cursor-pointer'
                      : 'border-[#110B1E] bg-[#25104A] shadow-[0_5px_0_#110B1E] hover:border-[#00E5FF] hover:-translate-y-1 cursor-pointer'
                }`}
              >
                <div>
                  <div className="flex items-center gap-3.5">
                    <div
                      className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-[2.5px] border-[#110B1E]"
                      style={{ backgroundColor: `${char.primaryColor}28` }}
                    >
                      <div className={isUnlocked ? '' : 'grayscale brightness-50'}>
                        <CharacterPortrait
                          characterId={char.id}
                          size={76}
                          animateWalk={isUnlocked}
                        />
                      </div>
                      {!isUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45">
                          <Lock className="h-7 w-7 text-amber-300" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-display text-xl text-white group-hover:text-[#FFE600]">
                        {char.name}
                      </h2>
                      <p className="text-xs font-semibold text-[#00E5FF]">
                        {isUnlocked ? char.role : 'Personaje bloqueado'}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-purple-200/85">
                        {isUnlocked ? char.bio : char.unlockHint}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3.5 rounded-xl border-2 border-[#110B1E] bg-[#160830] p-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 font-bold text-[#FFE600]">
                        <Sparkles className="h-3.5 w-3.5" />
                        {char.powerName}
                      </span>
                      <span className="font-mono-hud flex items-center gap-1 text-[11px] font-bold text-amber-400">
                        <Droplets className="h-3 w-3" />
                        {char.fluidCost}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-purple-100/90">
                      {char.powerDescription}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs font-bold">
                  <span className="text-purple-300">
                    {isUnlocked
                      ? char.id === 'lautaro'
                        ? `Retroceso 1.5s · Recarga ${char.cooldown}s`
                        : `Dura ${char.powerDuration}s · Recarga ${char.cooldown}s`
                      : char.unlockHint}
                  </span>
                  {isUnlocked ? (
                    <span className="flex items-center gap-1 text-[#7CFF00] group-hover:translate-x-0.5 transition-transform">
                      {isFinalBossSelect
                        ? 'Enfrentar Jefe'
                        : inProgress
                          ? isSelected
                            ? 'Seguir (no gasta cambio)'
                            : 'Cambiar (usa 1/1)'
                          : 'Jugar'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-300/80">
                      <Lock className="h-3.5 w-3.5" />
                      Bloqueado
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Botón para volver si se abrió a mitad de partida */}
        {inProgress && !isFinalBossSelect && onResume && (
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onResume}
              className="rounded-xl border-2 border-[#110B1E] bg-[#3B1D6E] px-5 py-2 text-sm font-bold text-white hover:bg-[#4D288F] cursor-pointer"
            >
              Seguir jugando sin cambiar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
