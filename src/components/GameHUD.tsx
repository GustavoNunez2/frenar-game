import { Heart, Pause, Users, Zap } from 'lucide-react';
import { CHARACTERS } from '../game/characters';
import { HudSnapshot } from '../game/types';
import { CharacterPortrait } from './CharacterPortrait';

interface GameHUDProps {
  hud: HudSnapshot;
  onOpenCharacterSelect: () => void;
  onTogglePause: () => void;
}

/** Minimal upper HUD; compact and translucent power meter stays clear of play. */
export function GameHUD({ hud, onOpenCharacterSelect, onTogglePause }: GameHUDProps) {
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
      <header className="game-hud-top fixed inset-x-0 top-0 z-20 flex items-start justify-between p-2 sm:p-4">
        <section className="flex items-center gap-1.5 rounded-xl border border-[#110B1E]/80 bg-[#1A0B33]/70 p-1.5 shadow-md backdrop-blur-sm sm:gap-2 sm:rounded-2xl sm:border-2 sm:p-2" aria-label="Personaje seleccionado y cambios disponibles">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-[#110B1E] bg-[#2D1458]/90 sm:h-11 sm:w-11 sm:rounded-xl sm:border-2"><CharacterPortrait characterId={hud.characterId} size={38} animateWalk={false} powerPreview={hud.powerActive} /></div>
          <div className="min-w-0">
            <div className="font-display text-[11px] leading-tight text-[#FFE600] sm:text-sm">{character.name}</div>
            <button type="button" onClick={onOpenCharacterSelect} disabled={!canSwap} className={`mt-0.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold leading-tight sm:rounded-lg sm:px-2 sm:py-1 sm:text-[11px] ${canSwap ? 'bg-cyan-400/90 text-[#110B1E]' : 'bg-purple-950/85 text-purple-300/70'}`} aria-label={canSwap ? 'Cambiar personaje; un cambio disponible' : 'Cambio de personaje ya usado en esta pantalla'}>
              <Users className="h-3 w-3" />{hud.bossDefeated ? 'Libre' : canSwap ? 'Cambio 1/1' : 'Usado 0/1'}
            </button>
          </div>
        </section>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-0 rounded-lg border border-[#110B1E]/80 bg-[#1A0B33]/70 px-1.5 py-1.5 backdrop-blur-sm sm:gap-0.5 sm:rounded-xl sm:border-2 sm:px-2 sm:py-2" role="img" aria-label={`Corazones: ${hud.lives} de ${hud.maxLives}`}>
            {Array.from({ length: hud.maxLives }).map((_, index) => <Heart key={index} className={`h-3.5 w-3.5 sm:h-5 sm:w-5 ${index < hud.lives ? 'fill-[#FF2D87] text-[#FF2D87]' : 'fill-purple-950 text-purple-800'}`} />)}
          </div>
          <button type="button" onClick={onTogglePause} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#110B1E] bg-[#2D1458]/85 text-white shadow-md sm:h-11 sm:w-11 sm:rounded-xl sm:border-2" aria-label="Pausar y abrir configuración" title="Pausa (Esc)"><Pause className="h-4 w-4 sm:h-5 sm:w-5" /></button>
        </div>
      </header>

      <div className="power-hud fixed bottom-[max(0.55rem,env(safe-area-inset-bottom))] left-[max(0.55rem,env(safe-area-inset-left))] z-20 w-[min(34vw,10rem)] rounded-lg border border-[#110B1E]/70 bg-[#1A0B33]/55 p-1 text-left shadow backdrop-blur-[2px] sm:bottom-5 sm:left-5 sm:w-52 sm:rounded-xl sm:border-2 sm:bg-[#1A0B33]/90 sm:p-2 sm:backdrop-blur-sm" aria-label={`${character.powerName}: ${hud.powerActive ? 'activo' : hud.powerCooldown > 0 ? 'recargando' : `${Math.round(hud.fluid)} de ${hud.maxFluid} de líquido`}`}>
        <span className="mb-0.5 flex items-center justify-between gap-1 text-[8px] font-bold leading-tight tracking-wide text-amber-100/90 sm:mb-1 sm:gap-2 sm:text-[10px] sm:text-amber-200"><span className="flex min-w-0 items-center gap-1"><Zap className="h-2.5 w-2.5 shrink-0 sm:h-3.5 sm:w-3.5" /><span className="truncate">{character.powerName}</span></span><span className="shrink-0">{hud.powerActive ? `${hud.powerTimer.toFixed(1)}s` : hud.powerCooldown > 0.05 ? `${hud.powerCooldown.toFixed(1)}s` : `${Math.round(hud.fluid)}/${hud.maxFluid}`}</span></span>
        <span className="block h-1.5 overflow-hidden rounded-full border border-[#110B1E]/80 bg-[#10071f]/75 sm:h-3" role="progressbar" aria-label="Carga y disponibilidad del poder" aria-valuemin={0} aria-valuemax={100} aria-valuenow={powerPct}>
          <span className={`block h-full transition-[width] duration-200 ${powerReady || hud.powerActive ? 'bg-gradient-to-r from-[#FF2A00] via-[#FF7B00] to-[#FFE600]' : 'bg-gradient-to-r from-slate-600 to-slate-400'}`} style={{ width: `${powerPct}%` }} />
        </span>
      </div>
      {hud.powerFeedback && <div className="pointer-events-none fixed bottom-12 left-2 z-20 max-w-[34vw] truncate rounded-md bg-[#FFE600]/85 px-1.5 py-0.5 text-[9px] font-bold text-[#110B1E] sm:bottom-20 sm:left-5 sm:max-w-none sm:rounded-lg sm:px-3 sm:py-1 sm:text-xs">{hud.powerFeedback}</div>}
    </>
  );
}
