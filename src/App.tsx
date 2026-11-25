/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { CharacterSelectModal } from './components/CharacterSelectModal';
import { GameHUD } from './components/GameHUD';
import { GameOverlays } from './components/GameOverlays';
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

    const engine = new GameEngine(canvas, (snapshot) => {
      setHud(snapshot);
    });
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
    } else {
      engine.selectCharacterMidGame(id);
    }
  };

  const showCharacterModal =
    !hud ||
    hud.phase === 'CHARACTER_SELECT' ||
    hud.phase === 'FINAL_BOSS_SELECT';

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#120724]">
      {/* Lienzo principal HD 1280x720 con post-procesado WebGL */}
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        onContextMenu={(e) => {
          e.preventDefault();
          engineRef.current?.triggerPowerFromUI();
        }}
      />

      {/* HUD superior */}
      {hud && (
        <GameHUD
          hud={hud}
          onTriggerPower={() => engineRef.current?.triggerPowerFromUI()}
          onOpenCharacterSelect={() => engineRef.current?.openCharacterSelect()}
          onRestartLevel={() => engineRef.current?.restartCurrentLevel()}
          onNextLevel={() => engineRef.current?.nextLevel()}
          onTogglePause={() => {
            if (!engineRef.current) return;
            engineRef.current.setPhase(
              hud.phase === 'PAUSED' ? 'PLAYING' : 'PAUSED'
            );
          }}
          onToggleMute={() => engineRef.current?.toggleMute()}
          onSetMusicVolume={(pct) => engineRef.current?.setMusicVolumePercent(pct)}
          onStepMusicVolume={(delta) => engineRef.current?.stepMusicVolume(delta)}
        />
      )}

      {/* Franja discreta inferior con objetivo y controles */}
      {hud && hud.phase === 'PLAYING' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-2.5 z-10 flex justify-center px-4">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border-2 border-[#110B1E] bg-[#160830]/85 px-4 py-1.5 text-xs text-purple-100 backdrop-blur-sm">
            <span className="font-semibold text-[#FFE600]">
              {hud.isBossArena && hud.bossDefeated
                ? '¡Jefe derrotado! Prueba tu personaje libremente y entra al portal o pulsa Siguiente capítulo'
                : hud.isBossArena
                  ? hud.storyNote
                  : hud.partsCollected >= hud.partsTotal
                    ? '¡Repuestos completos! Corre hacia la salida'
                    : `Objetivo: ${hud.storyNote}`}
            </span>
            <span aria-hidden="true" className="text-purple-400">
              ·
            </span>
            <span className="text-purple-200/90">
              Mover: A/D o ←/→ · Agacharse: S/↓ · Saltar: Espacio/W/↑ · Poder: E/Shift · Música: +/-/M
            </span>
          </div>
        </div>
      )}

      {/* Selector de personajes (con bloqueo progresivo, desbloqueo post-victoria y selector previo al Monstruo Final) */}
      {showCharacterModal && (
        <CharacterSelectModal
          selectedId={hud?.characterId ?? 'rodolfo'}
          unlockedCharacters={
            hud?.unlockedCharacters ?? INITIAL_UNLOCKED_CHARACTERS
          }
          inProgress={hasStarted}
          isFinalBossSelect={hud?.phase === 'FINAL_BOSS_SELECT'}
          gameCompleted={hud?.gameCompleted ?? false}
          swapsRemaining={hud?.swapsRemaining ?? 1}
          musicVolume={hud?.musicVolume ?? 65}
          muted={hud?.muted ?? false}
          onSelectCharacter={handleSelectCharacter}
          onResume={
            hasStarted
              ? () => engineRef.current?.resumeFromCharacterSelect()
              : undefined
          }
          onResetProgress={() => {
            setHasStarted(false);
            engineRef.current?.resetProgress();
          }}
          onSetMusicVolume={(pct) => engineRef.current?.setMusicVolumePercent(pct)}
          onStepMusicVolume={(delta) => engineRef.current?.stepMusicVolume(delta)}
          onToggleMute={() => engineRef.current?.toggleMute()}
        />
      )}

      {/* Modales de Pausa, Nivel Completado, Jefe Derrotado, Cinemática, Game Over y Victoria */}
      {hud && (
        <GameOverlays
          hud={hud}
          onResume={() => engineRef.current?.setPhase('PLAYING')}
          onRestartLevel={() => engineRef.current?.restartCurrentLevel()}
          onNextLevel={() => engineRef.current?.nextLevel()}
          onPlayAgain={() => {
            if (!engineRef.current) return;
            engineRef.current.startNewGame('rodolfo');
          }}
          onOpenCharacterSelect={() => engineRef.current?.openCharacterSelect()}
          onSetMusicVolume={(pct) => engineRef.current?.setMusicVolumePercent(pct)}
          onStepMusicVolume={(delta) => engineRef.current?.stepMusicVolume(delta)}
          onToggleMute={() => engineRef.current?.toggleMute()}
        />
      )}
    </main>
  );
}
