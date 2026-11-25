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

const names: Record<CharacterId, string> = {
  rodolfo: 'Rodolfo', marcela: 'Marcela', gustavo: 'Gustavo',
  micaela: 'Micaela', lautaro: 'Lautaro', leandro: 'Leandro',
};

export function PauseSettingsModal({
  hud, isFullscreen, onToggleFullscreen, onResume, onRestartLevel,
  onResetProgress, onSetMusicVolume, onStepMusicVolume, onToggleMute,
}: PauseSettingsModalProps) {
  if (hud.phase !== 'PAUSED') return null;
  const unlocked = hud.unlockedCharacters.map((id) => names[id]).join(' · ');

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[#0F0520]/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="pause-title" onClick={(event) => { if (event.target === event.currentTarget) onResume(); }}>
      <section className="my-auto w-full max-w-xl rounded-3xl border-4 border-[#110B1E] bg-[#210D44] p-5 text-white shadow-[0_12px_0_#110B1E] sm:p-7">
        <h2 id="pause-title" className="font-display text-center text-2xl text-[#FFE600] sm:text-3xl">PAUSA · CONFIGURACIÓN</h2>
        <p className="mt-2 text-center text-sm text-purple-200">{hud.levelTitle} · Jugando con {names[hud.characterId]}</p>

        <div className="mt-5 rounded-xl border-2 border-[#110B1E] bg-[#160830] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-bold text-amber-200"><Music className="h-4 w-4" />Música en bits · Cuarteto cordobés</span>
            <button type="button" onClick={onToggleMute} className="rounded-lg bg-[#2D1458] p-2" aria-label={hud.muted ? 'Activar música' : 'Silenciar música'}>{hud.muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-lime-300" />}</button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onStepMusicVolume(-0.1)} className="rounded-lg bg-[#3A1B6E] p-2" aria-label="Bajar volumen"><Minus className="h-4 w-4" /></button>
            <input type="range" min={0} max={100} step={5} value={hud.muted ? 0 : hud.musicVolume} onChange={(event) => onSetMusicVolume(Number(event.target.value))} className="w-full accent-[#FFE600]" aria-label="Volumen de música" />
            <button type="button" onClick={() => onStepMusicVolume(0.1)} className="rounded-lg bg-[#3A1B6E] p-2" aria-label="Subir volumen"><Plus className="h-4 w-4" /></button>
            <span className="w-10 text-right text-xs">{hud.muted ? '0%' : `${hud.musicVolume}%`}</span>
          </div>
          <p className="mt-1 text-[11px] text-purple-300">Volumen y silencio se guardan automáticamente en este dispositivo.</p>
        </div>

        <div className="mt-3 rounded-xl border-2 border-[#110B1E] bg-[#160830] p-3 text-sm">
          <h3 className="font-bold text-cyan-300">Progreso y personajes</h3>
          <p className="mt-1 text-xs leading-relaxed text-purple-200">Desbloqueados: {unlocked || 'Rodolfo'}</p>
          <p className="mt-1 text-xs text-purple-300">Cambios restantes en esta pantalla: {hud.bossDefeated ? 'libres (jefe derrotado)' : hud.swapsRemaining}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onRestartLevel} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#3A1B6E] px-3 py-2 text-xs font-bold"><RotateCcw className="h-4 w-4" />Reiniciar pantalla</button>
            <button type="button" onClick={() => { if (window.confirm('¿Reiniciar todo el progreso y los personajes desbloqueados?')) onResetProgress(); }} className="rounded-lg border border-rose-400/50 px-3 py-2 text-xs font-bold text-rose-200">Reiniciar progreso</button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border-2 border-[#110B1E] bg-[#160830] p-3">
          <h3 className="text-sm font-bold text-lime-300">Ayuda rápida</h3>
          <p className="mt-1 text-xs leading-relaxed text-purple-200">Mover: arrastrá horizontalmente · Agacharse: arrastrá hacia abajo · Tocar: saltar · Mantener el botón de acción: poder · Teclado: A/D o ←/→, S/↓, Espacio/W/↑ y E/Shift · Cambiar personaje: HUD (1 vez por pantalla) · Pausa: Esc.</p>
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onToggleFullscreen} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#110B1E] bg-[#3A1B6E] px-3 py-3 text-sm font-bold" aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Entrar en pantalla completa'}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}{isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          </button>
          <button type="button" onClick={onResume} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-[3px] border-[#110B1E] bg-[#7CFF00] px-4 py-3 text-sm font-bold text-[#110B1E] shadow-[0_4px_0_#110B1E]"><Play className="h-4 w-4 fill-current" />Continuar</button>
        </div>
      </section>
    </div>
  );
}
