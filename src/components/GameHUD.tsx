import { Pause, Users, Zap, Heart } from 'lucide-react';
import { CHARACTERS } from '../game/characters';
import { HudSnapshot } from '../game/types';
import { CharacterPortrait } from './CharacterPortrait';

interface GameHUDProps {
  hud: HudSnapshot;
  onTriggerPower: () => void;
  onOpenCharacterSelect: () => void;
  onTogglePause: () => void;
}

/** HUD de partida: personaje/cambios y corazones arriba; poder abajo a la izquierda. */
export function GameHUD({ hud, onTriggerPower, onOpenCharacterSelect, onTogglePause }: GameHUDProps) {
  if (hud.phase !== 'PLAYING') return null;

  const character = CHARACTERS[hud.characterId];
  const canSwap = hud.swapsRemaining > 0 || hud.bossDefeated;
  const fluidPct = hud.maxFluid > 0 ? Math.max(0, Math.min(100, (hud.fluid / hud.maxFluid) * 100)) : 0;
  const powerPct = hud.powerActive
    ? Math.max(0, Math.min(100, (hud.powerTimer / Math.max(0.1, hud.powerDuration)) * 100))
    : hud.powerCooldown > 0
      ? Math.max(0, Math.min(100, 100 - (hud.powerCooldown / Math.max(0.1, hud.powerMaxCooldown)) * 100))
      : fluidPct;
  const powerReady = hud.fluid >= character.fluidCost && hud.powerCooldown <= 0.05;

  return (
    <>
      <header className="game-hud-top fixed inset-x-0 top-0 z-20 flex items-start justify-between p-3 sm:p-4">
        <section className="flex items-center gap-2 rounded-2xl border-2 border-[#110B1E] bg-[#1A0B33]/90 p-2 shadow-lg backdrop-blur-sm" aria-label="Personaje seleccionado y cambios disponibles">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border-2 border-[#110B1E] bg-[#2D1458]">
            <CharacterPortrait characterId={hud.characterId} size={48} animateWalk={false} powerPreview={hud.powerActive} />
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm text-[#FFE600]">{character.name}</div>
            <button type="button" onClick={onOpenCharacterSelect} disabled={!canSwap} className={`mt-0.5 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold ${canSwap ? 'bg-cyan-400 text-[#110B1E]' : 'bg-purple-950 text-purple-300/60'}`} aria-label={canSwap ? 'Cambiar personaje; un cambio disponible' : 'Cambio de personaje ya usado en esta pantalla'}>
              <Users className="h-3 w-3" />{hud.bossDefeated ? 'Cambio libre' : canSwap ? 'Cambio disponible 1/1' : 'Cambio usado 0/1'}
            </button>
          </div>
        </section>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-xl border-2 border-[#110B1E] bg-[#1A0B33]/90 px-2 py-2" role="img" aria-label={`Corazones: ${hud.lives} de ${hud.maxLives}`}>
            {Array.from({ length: hud.maxLives }).map((_, i) => <Heart key={i} className={`h-5 w-5 ${i < hud.lives ? 'fill-[#FF2D87] text-[#FF2D87]' : 'fill-purple-950 text-purple-800'}`} />)}
          </div>
          <button type="button" onClick={onTogglePause} className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#110B1E] bg-[#2D1458]/95 text-white shadow-lg" aria-label="Pausar y abrir configuración" title="Pausa (Esc)"><Pause className="h-5 w-5" /></button>
        </div>
      </header>

      <button type="button" onClick={onTriggerPower} className="power-hud fixed bottom-4 left-3 z-20 w-52 rounded-xl border-2 border-[#110B1E] bg-[#1A0B33]/90 p-2 text-left shadow-lg backdrop-blur-sm sm:bottom-5 sm:left-5" aria-label={`${character.powerName}: ${hud.powerActive ? 'activo' : hud.powerCooldown > 0 ? 'recargando' : `${Math.round(hud.fluid)} de ${hud.maxFluid} de líquido`}`}>
        <span className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold tracking-wide text-amber-200"><span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5" />{character.powerName}</span><span>{hud.powerActive ? `ACTIVO ${hud.powerTimer.toFixed(1)}s` : hud.powerCooldown > 0.05 ? `RECARGA ${hud.powerCooldown.toFixed(1)}s` : `${Math.round(hud.fluid)}/${hud.maxFluid}`}</span></span>
        <span className="block h-3 overflow-hidden rounded-full border border-[#110B1E] bg-[#10071f]" role="progressbar" aria-label="Carga y disponibilidad del poder" aria-valuemin={0} aria-valuemax={100} aria-valuenow={powerPct}>
          <span className={`block h-full transition-[width] duration-200 ${powerReady || hud.powerActive ? 'bg-gradient-to-r from-[#FF2A00] via-[#FF7B00] to-[#FFE600]' : 'bg-gradient-to-r from-slate-600 to-slate-400'}`} style={{ width: `${powerPct}%` }} />
        </span>
      </button>
      {hud.powerFeedback && <div className="pointer-events-none fixed bottom-20 left-3 z-20 rounded-lg bg-[#FFE600] px-3 py-1 text-xs font-bold text-[#110B1E] sm:left-5">{hud.powerFeedback}</div>}
    </>
  );
}
