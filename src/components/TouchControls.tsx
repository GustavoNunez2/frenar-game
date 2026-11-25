import { useEffect, useRef } from 'react';
import { ArrowUp, Zap } from 'lucide-react';

interface TouchControlsProps {
  canvas: HTMLCanvasElement | null;
  onJump: () => void;
  onPower: () => void;
}

const dispatchKey = (code: string, type: 'keydown' | 'keyup') => {
  const key = code.startsWith('Arrow') ? code.slice(5) : code === 'Space' ? ' ' : code.slice(3);
  window.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true }));
};

/** Drag to move/crouch, with independent tap controls for jump and power. */
export function TouchControls({ canvas, onJump, onPower }: TouchControlsProps) {
  const callbacks = useRef({ onJump, onPower });
  callbacks.current = { onJump, onPower };

  useEffect(() => {
    if (!canvas) return;
    const activePointers = new Map<number, { startX: number; startY: number; direction: 'ArrowLeft' | 'ArrowRight' | null; crouching: boolean }>();
    const setPointerKeys = (state: { direction: 'ArrowLeft' | 'ArrowRight' | null; crouching: boolean }, direction: 'ArrowLeft' | 'ArrowRight' | null, crouching: boolean) => {
      if (state.direction !== direction) {
        if (state.direction) dispatchKey(state.direction, 'keyup');
        if (direction) dispatchKey(direction, 'keydown');
        state.direction = direction;
      }
      if (state.crouching !== crouching) {
        dispatchKey('ArrowDown', crouching ? 'keydown' : 'keyup');
        state.crouching = crouching;
      }
    };
    const onDown = (event: PointerEvent) => {
      if (event.target !== canvas || event.pointerType === 'mouse') return;
      event.preventDefault();
      activePointers.set(event.pointerId, { startX: event.clientX, startY: event.clientY, direction: null, crouching: false });
      try { canvas.setPointerCapture(event.pointerId); } catch { /* pointer may have already ended */ }
    };
    const onMove = (event: PointerEvent) => {
      const state = activePointers.get(event.pointerId);
      if (!state) return;
      event.preventDefault();
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      // A stable dead zone around the initial contact; direction follows total drag, not noisy deltas.
      const direction = Math.abs(dx) < 26 ? null : dx < 0 ? 'ArrowLeft' : 'ArrowRight';
      // Downward crouch is latched at a clear threshold and released on the way back up.
      const crouching = dy > 38;
      setPointerKeys(state, direction, crouching);
    };
    const finish = (event: PointerEvent) => {
      const state = activePointers.get(event.pointerId);
      if (!state) return;
      setPointerKeys(state, null, false);
      activePointers.delete(event.pointerId);
    };
    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
    canvas.addEventListener('lostpointercapture', finish);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', finish);
      canvas.removeEventListener('pointercancel', finish);
      canvas.removeEventListener('lostpointercapture', finish);
      for (const state of activePointers.values()) setPointerKeys(state, null, false);
      activePointers.clear();
    };
  }, [canvas]);

  return (
    <nav className="touch-controls fixed inset-0 z-20 pointer-events-none" aria-label="Controles táctiles">
      <div className="touch-action-group pointer-events-auto fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] flex items-center gap-3 sm:gap-4">
        <button type="button" className="touch-control touch-jump" aria-label="Saltar" title="Saltar" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); callbacks.current.onJump(); }} onContextMenu={(event) => event.preventDefault()}><ArrowUp className="h-6 w-6" /></button>
        <button type="button" className="touch-control touch-power" aria-label="Activar poder" title="Activar poder" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); callbacks.current.onPower(); }} onContextMenu={(event) => event.preventDefault()}><Zap className="h-6 w-6" /></button>
      </div>
      <p className="touch-gesture-hint pointer-events-none fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full bg-[#120722]/45 px-2 py-1 text-[9px] text-white/60">Arrastrá para moverte · hacia abajo para agacharte</p>
    </nav>
  );
}
