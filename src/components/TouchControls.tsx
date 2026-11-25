import { useEffect, useRef } from 'react';
import { ArrowUp, Zap } from 'lucide-react';

interface TouchControlsProps {
  canvas: HTMLCanvasElement | null;
  onJump: () => void;
  onPower: () => void;
}

type Direction = 'ArrowLeft' | 'ArrowRight';
type DragState = { startX: number; startY: number; direction: Direction | null; crouching: boolean };
const dispatchKey = (code: string, type: 'keydown' | 'keyup') => {
  const key = code.startsWith('Arrow') ? code.slice(5) : code === 'Space' ? ' ' : code.slice(3);
  window.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true }));
};

/** Drag on the playfield to move/crouch; action buttons stay independent. */
export function TouchControls({ canvas, onJump, onPower }: TouchControlsProps) {
  const callbacks = useRef({ onJump, onPower });
  callbacks.current = { onJump, onPower };

  useEffect(() => {
    if (!canvas) return;
    const pointers = new Map<number, DragState>();
    const held = new Set<string>();
    const updateHeld = () => {
      const next = new Set<string>();
      for (const state of pointers.values()) {
        if (state.direction) next.add(state.direction);
        if (state.crouching) next.add('ArrowDown');
      }
      for (const code of held) if (!next.has(code)) dispatchKey(code, 'keyup');
      for (const code of next) if (!held.has(code)) dispatchKey(code, 'keydown');
      held.clear();
      next.forEach((code) => held.add(code));
    };
    const updatePointer = (state: DragState, x: number, y: number) => {
      const dx = x - state.startX;
      const dy = y - state.startY;
      // Low activation threshold plus hysteresis keeps movement quick without noisy toggles.
      if (state.direction === null) {
        if (Math.abs(dx) >= 12) state.direction = dx < 0 ? 'ArrowLeft' : 'ArrowRight';
      } else if (state.direction === 'ArrowLeft' && dx > -5) {
        state.direction = Math.abs(dx) >= 12 ? 'ArrowRight' : null;
      } else if (state.direction === 'ArrowRight' && dx < 5) {
        state.direction = Math.abs(dx) >= 12 ? 'ArrowLeft' : null;
      }
      if (!state.crouching && dy >= 24) state.crouching = true;
      else if (state.crouching && dy <= 14) state.crouching = false;
      updateHeld();
    };
    const onDown = (event: PointerEvent) => {
      // Only direct contact on the canvas starts a drag; buttons/modal controls never become movement.
      if (event.target !== canvas || event.pointerType === 'mouse') return;
      event.preventDefault();
      pointers.set(event.pointerId, { startX: event.clientX, startY: event.clientY, direction: null, crouching: false });
      try { canvas.setPointerCapture(event.pointerId); } catch { /* pointer may have already ended */ }
    };
    const onMove = (event: PointerEvent) => {
      const state = pointers.get(event.pointerId);
      if (!state) return;
      event.preventDefault();
      updatePointer(state, event.clientX, event.clientY);
    };
    const finish = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return;
      updateHeld();
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
      pointers.clear();
      updateHeld();
    };
  }, [canvas]);

  return (
    <nav className="touch-controls fixed inset-0 z-20 pointer-events-none" aria-label="Controles táctiles">
      <div className="touch-action-group pointer-events-auto fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] flex items-center gap-2 sm:gap-3">
        <button type="button" className="touch-control touch-jump" aria-label="Saltar" title="Saltar" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); callbacks.current.onJump(); }} onContextMenu={(event) => event.preventDefault()}><ArrowUp className="h-5 w-5" /></button>
        <button type="button" className="touch-control touch-power" aria-label="Activar poder" title="Activar poder" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); callbacks.current.onPower(); }} onContextMenu={(event) => event.preventDefault()}><Zap className="h-5 w-5" /></button>
      </div>
    </nav>
  );
}
