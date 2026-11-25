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

/** Gesto de arrastre sobre el escenario y un único botón: toque=saltar, mantener=poder. */
export function TouchControls({ canvas, onJump, onPower }: TouchControlsProps) {
  const actionTimer = useRef<number | null>(null);
  const powerTriggered = useRef(false);

  useEffect(() => {
    if (!canvas) return;
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let movingCode: 'ArrowLeft' | 'ArrowRight' | null = null;
    let crouching = false;

    const onDown = (event: PointerEvent) => {
      if (event.target !== canvas || event.pointerType === 'mouse') return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      event.preventDefault();
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const nextDirection = Math.abs(dx) > 18 ? (dx < 0 ? 'ArrowLeft' : 'ArrowRight') : null;
      if (nextDirection !== movingCode) {
        if (movingCode) dispatchKey(movingCode, 'keyup');
        movingCode = nextDirection;
        if (movingCode) dispatchKey(movingCode, 'keydown');
      }
      const shouldCrouch = dy > 28;
      if (shouldCrouch !== crouching) {
        crouching = shouldCrouch;
        dispatchKey('ArrowDown', crouching ? 'keydown' : 'keyup');
      }
    };
    const finish = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      if (movingCode) dispatchKey(movingCode, 'keyup');
      if (crouching) dispatchKey('ArrowDown', 'keyup');
      movingCode = null;
      crouching = false;
      pointerId = null;
    };

    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', finish);
      canvas.removeEventListener('pointercancel', finish);
      if (movingCode) dispatchKey(movingCode, 'keyup');
      if (crouching) dispatchKey('ArrowDown', 'keyup');
    };
  }, [canvas]);

  useEffect(() => () => {
    if (actionTimer.current !== null) window.clearTimeout(actionTimer.current);
  }, []);

  const beginAction = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    powerTriggered.current = false;
    actionTimer.current = window.setTimeout(() => {
      powerTriggered.current = true;
      onPower();
    }, 420);
  };
  const endAction = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (actionTimer.current !== null) window.clearTimeout(actionTimer.current);
    actionTimer.current = null;
    if (!powerTriggered.current) onJump();
  };

  return (
    <nav className="touch-controls fixed inset-0 z-20 pointer-events-none" aria-label="Controles táctiles">
      <button
        type="button"
        className="touch-control touch-action-button pointer-events-auto fixed bottom-5 right-5"
        aria-label="Tocar para saltar; mantener para activar el poder"
        title="Toque: saltar · Mantener: poder"
        onPointerDown={beginAction}
        onPointerUp={endAction}
        onPointerCancel={endAction}
        onLostPointerCapture={endAction}
        onContextMenu={(event) => event.preventDefault()}
      >
        <ArrowUp className="h-7 w-7" />
        <Zap className="touch-action-badge h-4 w-4" />
      </button>
    </nav>
  );
}
