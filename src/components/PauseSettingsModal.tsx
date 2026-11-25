import { Maximize, Minimize, Minus, Music, Play, Plus, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { CharacterId, HudSnapshot } from '../game/types';

interface PauseSettingsModalProps {
  hud: HudSnapshot;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onResume: () => void;
  onRestartLevel: () => void;
  onResetProgress: () => void;
  onSetMusicVolume: (percent: number) => void;
  onStepMusicVolume: (delta: number) => void;
  onToggleMute: () => void;
}

const names: Record<CharacterId, string> = { rodolfo: 'Rodolfo', marcela: 'Marcela', gustavo: 'Gustavo', micaela: 'Micaela', lautaro: 'Lautaro', leandro: 'Leandro' };

export function PauseSettingsModal({ hud, isFullscreen, onToggleFullscreen, onResume, onRestartLevel, onResetProgress, onSetMusicVolume, onStepMusicVolume, onToggleMute }: PauseSettingsModalProps) {
  if (hud.phase !== 'PAUSED') return null;
  const unlocked = hud.unlockedCharacters.map((id) => names[id]).join(' · ');
  return (
    <div className="pause-settings-overlay fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[#0F0520]/85 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <section className="pause-settings-panel my-auto w-full max-w-3xl rounded-2xl border-2 border-[#110B1E] bg-[#210D44] p-3 text-white shadow-[0_8px_0_#110B1E] sm:rounded-3xl sm:border-4 sm:p-6 sm:shadow-[0_12px_0_#110B1E]">
        <h2 id="pause-title" className="font-display text-center text-lg text-[#FFE600] sm:text-3xl">PAUSA · CONFIGURACIÓN</h2>
        <p className="mt-1 text-center text-xs text-purple-200 sm:mt-2 sm:text-sm">{hud.levelTitle} · Jugando con {names[hud.characterId]}</p>
        <div className="pause-settings-grid mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3">
          <div className="rounded-xl border border-[#110B1E] bg-[#160830] p-2 sm:border-2 sm:p-3">
            <div className="mb-1 flex items-center justify-between gap-2 sm:mb-2"><span className="flex items-center gap-1 text-[11px] font-bold text-amber-200 sm:gap-2 sm:text-sm"><Music className="h-3.5 w-3.5 sm:h-4 sm:w-4" />Música · Cuarteto</span><button type="button" onClick={onToggleMute} className="rounded-lg bg-[#2D1458] p-1.5 sm:p-2" aria-label={hud.muted ? 'Activar música' : 'Silenciar música'}>{hud.muted ? <VolumeX className="h-3.5 w-3.5 text-rose-400 sm:h-4 sm:w-4" /> : <Volume2 className="h-3.5 w-3.5 text-lime-300 sm:h-4 sm:w-4" />}</button></div>
            <div className="flex items-center gap-1.5"><button type="button" onClick={() => onStepMusicVolume(-0.1)} className="rounded-lg bg-[#3A1B6E] p-1.5" aria-label="Bajar volumen"><Minus className="h-3.5 w-3.5" /></button><input type="range" min={0} max={100} step={5} value={hud.muted ? 0 : hud.musicVolume} onChange={(event) => onSetMusicVolume(Number(event.target.value))} className="w-full accent-[#FFE600]" aria-label="Volumen de música" /><button type="button" onClick={() => onStepMusicVolume(0.1)} className="rounded-lg bg-[#3A1B6E] p-1.5" aria-label="Subir volumen"><Plus className="h-3.5 w-3.5" /></button><span className="w-8 text-right text-[10px] sm:w-10 sm:text-xs">{hud.muted ? '0%' : `${hud.musicVolume}%`}</span></div>
            <p className="mt-1 text-[9px] text-purple-300 sm:text-[11px]">Preferencia guardada en este dispositivo.</p>
          </div>
          <div className="rounded-xl border border-[#110B1E] bg-[#160830] p-2 text-xs sm:border-2 sm:p-3 sm:text-sm">
            <h3 className="font-bold text-cyan-300">Progreso y personajes</h3><p className="mt-1 text-[10px] leading-tight text-purple-200 sm:text-xs">Desbloqueados: {unlocked || 'Rodolfo'}</p><p className="mt-1 text-[9px] leading-tight text-purple-300 sm:text-xs">Cambios restantes: {hud.bossDefeated ? 'libres (jefe derrotado)' : hud.swapsRemaining}</p>
            <div className="mt-2 flex flex-wrap gap-1.5"><button type="button" onClick={onRestartLevel} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#3A1B6E] px-2 py-1.5 text-[10px] font-bold sm:gap-2 sm:py-2 sm:text-xs"><RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />Reiniciar</button><button type="button" onClick={() => { if (window.confirm('¿Reiniciar todo el progreso y los personajes desbloqueados?')) onResetProgress(); }} className="rounded-lg border border-rose-400/50 px-2 py-1.5 text-[10px] font-bold text-rose-200 sm:py-2 sm:text-xs">Reiniciar progreso</button></div>
          </div>
          <div className="col-span-2 rounded-xl border border-[#110B1E] bg-[#160830] p-2 sm:border-2 sm:p-3"><h3 className="text-[11px] font-bold text-lime-300 sm:text-sm">Ayuda rápida</h3><p className="mt-1 text-[9px] leading-tight text-purple-200 sm:text-xs">Mover: arrastrá horizontalmente · Agacharse: arrastrá hacia abajo · Tocar: saltar · Poder: botón ⚡ · Teclado: A/D o ←/→, S/↓, Espacio/W/↑ y E/Shift · Pausa: Esc.</p></div>
        </div>
        <div className="mt-3 flex gap-2 sm:mt-4"><button type="button" onClick={onToggleFullscreen} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-[#110B1E] bg-[#3A1B6E] px-2 py-2 text-[10px] font-bold sm:gap-2 sm:px-3 sm:py-3 sm:text-sm" aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Entrar en pantalla completa'}>{isFullscreen ? <Minimize className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Maximize className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}{isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</button><button type="button" onClick={onResume} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-[3px] border-[#110B1E] bg-[#7CFF00] px-3 py-2 text-[11px] font-bold text-[#110B1E] shadow-[0_3px_0_#110B1E] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm sm:shadow-[0_4px_0_#110B1E]"><Play className="h-3.5 w-3.5 fill-current sm:h-4 sm:w-4" />Continuar</button></div>
      </section>
    </div>
  );
}
