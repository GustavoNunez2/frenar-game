import { useCallback, useEffect, useRef, useState } from 'react';
import { CharacterSelectModal } from './components/CharacterSelectModal';
import { GameHUD } from './components/GameHUD';
import { GameOverlays } from './components/GameOverlays';
import { PauseSettingsModal } from './components/PauseSettingsModal';
import { TouchControls } from './components/TouchControls';
import { INITIAL_UNLOCKED_CHARACTERS } from './game/characters';
import { GameEngine } from './game/engine';
import { CharacterId, HudSnapshot } from './game/types';

function lockLandscape(): void {
  try {
    const orientation = window.screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> };
    if (typeof orientation?.lock === 'function') void orientation.lock('landscape').catch(() => undefined);
  } catch { /* La orientación no está disponible o el navegador la rechaza. */ }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const pausedForPortrait = useRef(false);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const aspect = window.innerWidth / Math.max(1, window.innerHeight);
      canvas.height = 720;
      canvas.width = Math.max(960, Math.round(720 * aspect));
    };
    resize();
    window.addEventListener('resize', resize);
    const engine = new GameEngine(canvas, setHud);
    engineRef.current = engine;
    engine.startLoop();
    return () => {
      window.removeEventListener('resize', resize);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const updateOrientation = () => {
      const touchDevice = window.matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && window.innerWidth <= 900);
      setIsMobile(touchDevice);
      setIsPortrait(touchDevice && window.innerHeight > window.innerWidth);
    };
    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    window.screen.orientation?.addEventListener?.('change', updateOrientation);
    lockLandscape();
    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
      window.screen.orientation?.removeEventListener?.('change', updateOrientation);
    };
  }, []);

  useEffect(() => {
    if (!isMobile || !hasStarted || !hud) return;
    if (isPortrait && hud.phase === 'PLAYING') {
      pausedForPortrait.current = true;
      engineRef.current?.setPhase('PAUSED');
    } else if (!isPortrait && pausedForPortrait.current && hud.phase === 'PAUSED') {
      pausedForPortrait.current = false;
      engineRef.current?.setPhase('PLAYING');
    }
  }, [hasStarted, hud, isMobile, isPortrait]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      } else {
        const target = mainRef.current;
        if (target?.requestFullscreen) {
          await target.requestFullscreen();
          lockLandscape();
        }
      }
    } catch { /* Fullscreen/orientation may be blocked by browser policy. */ }
  }, []);

  const handleSelectCharacter = (id: CharacterId) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!hasStarted) {
      setHasStarted(true);
      engine.startNewGame(id);
    } else engine.selectCharacterMidGame(id);
  };
  const togglePause = () => {
    if (!engineRef.current || !hud) return;
    engineRef.current.setPhase(hud.phase === 'PAUSED' ? 'PLAYING' : 'PAUSED');
  };
  const jump = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
  };
  const showCharacterModal = !hud || hud.phase === 'CHARACTER_SELECT' || hud.phase === 'FINAL_BOSS_SELECT';
  const showRotateNotice = isMobile && isPortrait && hasStarted;

  return (
    <main ref={mainRef} className="game-area relative h-screen w-screen overflow-hidden bg-[#120724]">
      <canvas ref={canvasRef} className="game-canvas block h-full w-full" onContextMenu={(event) => { event.preventDefault(); engineRef.current?.triggerPowerFromUI(); }} />
      {hud && <GameHUD hud={hud} onOpenCharacterSelect={() => engineRef.current?.openCharacterSelect()} onTogglePause={togglePause} />}
      {isMobile && hud?.phase === 'PLAYING' && !showRotateNotice && <TouchControls canvas={canvasRef.current} onJump={jump} onPower={() => engineRef.current?.triggerPowerFromUI()} />}
      {showCharacterModal && <CharacterSelectModal selectedId={hud?.characterId ?? 'rodolfo'} unlockedCharacters={hud?.unlockedCharacters ?? INITIAL_UNLOCKED_CHARACTERS} inProgress={hasStarted} isFinalBossSelect={hud?.phase === 'FINAL_BOSS_SELECT'} gameCompleted={hud?.gameCompleted ?? false} swapsRemaining={hud?.swapsRemaining ?? 1} musicVolume={hud?.musicVolume ?? 65} muted={hud?.muted ?? false} onSelectCharacter={handleSelectCharacter} onResume={hasStarted ? () => engineRef.current?.resumeFromCharacterSelect() : undefined} onResetProgress={() => { setHasStarted(false); engineRef.current?.resetProgress(); }} onSetMusicVolume={(pct) => engineRef.current?.setMusicVolumePercent(pct)} onStepMusicVolume={(delta) => engineRef.current?.stepMusicVolume(delta)} onToggleMute={() => engineRef.current?.toggleMute()} />}
      {hud && hud.phase !== 'PAUSED' && <GameOverlays hud={hud} onResume={() => engineRef.current?.setPhase('PLAYING')} onRestartLevel={() => engineRef.current?.restartCurrentLevel()} onNextLevel={() => engineRef.current?.nextLevel()} onPlayAgain={() => { engineRef.current?.startNewGame('rodolfo'); setHasStarted(true); }} onOpenCharacterSelect={() => engineRef.current?.openCharacterSelect()} onSetMusicVolume={(pct) => engineRef.current?.setMusicVolumePercent(pct)} onStepMusicVolume={(delta) => engineRef.current?.stepMusicVolume(delta)} onToggleMute={() => engineRef.current?.toggleMute()} />}
      {hud && !showRotateNotice && <PauseSettingsModal hud={hud} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} onResume={() => engineRef.current?.setPhase('PLAYING')} onRestartLevel={() => engineRef.current?.restartCurrentLevel()} onResetProgress={() => { setHasStarted(false); engineRef.current?.resetProgress(); }} onSetMusicVolume={(pct) => engineRef.current?.setMusicVolumePercent(pct)} onStepMusicVolume={(delta) => engineRef.current?.stepMusicVolume(delta)} onToggleMute={() => engineRef.current?.toggleMute()} />}
      {showRotateNotice && <div className="orientation-lock fixed inset-0 z-[60] flex items-center justify-center bg-[#0F0520]/95 p-6 text-center backdrop-blur-md" role="alertdialog" aria-modal="true" aria-labelledby="rotate-title"><div className="max-w-sm rounded-3xl border-4 border-[#FFE600] bg-[#210D44] p-7 text-white shadow-2xl"><div className="rotate-phone-icon mx-auto mb-5" aria-hidden="true">▰</div><h2 id="rotate-title" className="font-display text-2xl text-[#FFE600]">GIRÁ EL CELULAR</h2><p className="mt-3 text-base leading-relaxed text-purple-100">Para jugar, poné el teléfono en posición horizontal.</p><p className="mt-3 text-xs text-purple-300">La partida está pausada. Se reanuda al girar el dispositivo.</p></div></div>}
    </main>
  );
}
