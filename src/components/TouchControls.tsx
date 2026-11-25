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

/** Touch drag controls game movement; two separate action buttons handle jump and power. */
export function TouchControls({ canvas, onJump, onPower }: TouchControlsProps) {
  const callbacks = useRef({ onJump, onPower });
  callbacks.current = { onJump, onPower };

  useEffect(() => {
    if (!canvas) return;
    const pointers = new Map<number, DragState>();
    const held = new Set<string>();

    const syncHeldKeys = () => {
      const next = new Set<string>();
      for (const pointer of pointers.values()) {
        if (pointer.direction) next.add(pointer.direction);
        if (pointer.crouching) next.add('ArrowDown');
      }
      for (const code of held) if (!next.has(code)) dispatchKey(code, 'keyup');
      for (const code of next) if (!held.has(code)) dispatchKey(code, 'keydown');
      held.clear();
      next.forEach((code) => held.add(code));
    };

    const trackPointer = (pointer: DragState, x: number, y: number) => {
      const dx = x - pointer.startX;
      const dy = y - pointer.startY;
      // Small threshold plus hysteresis avoids long drags and noisy direction flicker.
      if (pointer.direction === null) {
        if (Math.abs(dx) >= 12) pointer.direction = dx < 0 ? 'ArrowLeft' : 'ArrowRight';
      } else if (pointer.direction === 'ArrowLeft' && dx > -5) {
        pointer.direction = Math.abs(dx) >= 12 ? 'ArrowRight' : null;
      } else if (pointer.direction === 'ArrowRight' && dx < 5) {
        pointer.direction = Math.abs(dx) >= 12 ? 'ArrowLeft' : null;
      }
      if (!pointer.crouching && dy >= 24) pointer.crouching = true;
      else if (pointer.crouching && dy <= 14) pointer.crouching = false;
      syncHeldKeys();
    };

    const start = (event: PointerEvent) => {
      // Controls/buttons and other overlays do not initiate an in-world drag.
      if (event.target !== canvas || event.pointerType === 'mouse') return;
      event.preventDefault();
      pointers.set(event.pointerId, { startX: event.clientX, startY: event.clientY, direction: null, crouching: false });
      try { canvas.setPointerCapture(event.pointerId); } catch { /* pointer ended concurrently */ }
    };
    const move = (event: PointerEvent) => {
      const pointer = pointers.get(event.pointerId);
      if (!pointer) return;
      event.preventDefault();
      trackPointer(pointer, event.clientX, event.clientY);
    };
    const finish = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return;
      syncHeldKeys();
    };
    const releaseAll = () => {
      pointers.clear();
      syncHeldKeys();
    };

    canvas.addEventListener('pointerdown', start, { passive: false });
    canvas.addEventListener('pointermove', move, { passive: false });
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
    canvas.addEventListener('lostpointercapture', finish);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', releaseAll);

    return () => {
      canvas.removeEventListener('pointerdown', start);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', finish);
      canvas.removeEventListener('pointercancel', finish);
      canvas.removeEventListener('lostpointercapture', finish);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('blur', releaseAll);
      document.removeEventListener('visibilitychange', releaseAll);
      releaseAll();
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
