import { useEffect, useRef, useState } from 'react';
import { CharacterSelectModal } from './components/CharacterSelectModal';
import { GameHUD } from './components/GameHUD';
import { GameOverlays } from './components/GameOverlays';
import { PauseSettingsModal } from './components/PauseSettingsModal';
import { TouchControls } from './components/TouchControls';
import { INITIAL_UNLOCKED_CHARACTERS } from './game/characters';
import { GameEngine } from './game/engine';
import { CharacterId, HudSnapshot } from './game/types';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

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
  const showCharacterModal = !hud || hud.phase === 'CHARACTER_SELECT' || hud.phase === 'FINAL_BOSS_SELECT';

  return (
    <main className="game-area relative h-screen w-screen overflow-hidden bg-[#120724]">
      <canvas ref={canvasRef} className="game-canvas block h-full w-full" onContextMenu={(e) => { e.preventDefault(); engineRef.current?.triggerPowerFromUI(); }} />
      {hud && <GameHUD hud={hud} onTriggerPower={() => engineRef.current?.triggerPowerFromUI()} onOpenCharacterSelect={() => engineRef.current?.openCharacterSelect()} onTogglePause={togglePause} />}
      {hud && hud.phase === 'PLAYING' && <TouchControls onJump={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }))} onPower={() => engineRef.current?.triggerPowerFromUI()} onSwap={() => engineRef.current?.openCharacterSelect()} />}
      {showCharacterModal && <CharacterSelectModal selectedId={hud?.characterId ?? 'rodolfo'} unlockedCharacters={hud?.unlockedCharacters ?? INITIAL_UNLOCKED_CHARACTERS} inProgress={hasStarted} isFinalBossSelect={hud?.phase === 'FINAL_BOSS_SELECT'} gameCompleted={hud?.gameCompleted ?? false} swapsRemaining={hud?.swapsRemaining ?? 1} musicVolume={hud?.musicVolume ?? 65} muted={hud?.muted ?? false} onSelectCharacter={handleSelectCharacter} onResume={hasStarted ? () => engineRef.current?.resumeFromCharacterSelect() : undefined} onResetProgress={() => { setHasStarted(false); engineRef.current?.resetProgress(); }} onSetMusicVolume={(pct) => engineRef.current?.setMusicVolumePercent(pct)} onStepMusicVolume={(delta) => engineRef.current?.stepMusicVolume(delta)} onToggleMute={() => engineRef.current?.toggleMute()} />}
      {hud && hud.phase !== 'PAUSED' && <GameOverlays hud={hud} onResume={() => engineRef.current?.setPhase('PLAYING')} onRestartLevel={() => engineRef.current?.restartCurrentLevel()} onNextLevel={() => engineRef.current?.nextLevel()} onPlayAgain={() => { engineRef.current?.startNewGame('rodolfo'); setHasStarted(true); }} onOpenCharacterSelect={() => engineRef.current?.openCharacterSelect()} onSetMusicVolume={(pct) => engineRef.current?.setMusicVolumePercent(pct)} onStepMusicVolume={(delta) => engineRef.current?.stepMusicVolume(delta)} onToggleMute={() => engineRef.current?.toggleMute()} />}
      {hud && <PauseSettingsModal hud={hud} onResume={() => engineRef.current?.setPhase('PLAYING')} onRestartLevel={() => engineRef.current?.restartCurrentLevel()} onResetProgress={() => { setHasStarted(false); engineRef.current?.resetProgress(); }} onSetMusicVolume={(pct) => engineRef.current?.setMusicVolumePercent(pct)} onStepMusicVolume={(delta) => engineRef.current?.stepMusicVolume(delta)} onToggleMute={() => engineRef.current?.toggleMute()} />}
    </main>
  );
}
