import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Users, Zap } from 'lucide-react';

interface TouchControlsProps {
  onJump: () => void;
  onPower: () => void;
  onSwap: () => void;
}

const pressKey = (code: string, type: 'keydown' | 'keyup') => {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code === 'Space' ? ' ' : code.replace('Arrow', ''), bubbles: true }));
};

export function TouchControls({ onJump, onPower, onSwap }: TouchControlsProps) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const update = () => setEnabled(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  if (!enabled) return null;

  const hold = (label: string, code: string, icon: React.ReactNode, extraClass = '') => (
    <button type="button" aria-label={label} className={`touch-control ${extraClass}`} onContextMenu={(e) => e.preventDefault()} onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); pressKey(code, 'keydown'); }} onPointerUp={() => pressKey(code, 'keyup')} onPointerCancel={() => pressKey(code, 'keyup')} onLostPointerCapture={() => pressKey(code, 'keyup')}>{icon}</button>
  );

  return (
    <nav className="touch-controls fixed inset-0 z-20 pointer-events-none" aria-label="Controles táctiles">
      <div className="pointer-events-auto absolute bottom-4 left-3 flex items-end gap-2 sm:bottom-5 sm:left-5">
        <div className="flex gap-2">{hold('Mover a la izquierda', 'ArrowLeft', <ArrowLeft />)}{hold('Mover a la derecha', 'ArrowRight', <ArrowRight />)}</div>
        {hold('Agacharse', 'ArrowDown', <ArrowDown />, 'touch-crouch')}
      </div>
      <div className="pointer-events-auto absolute bottom-4 right-3 flex items-end gap-2 sm:bottom-5 sm:right-5">
        <button type="button" className="touch-control" aria-label="Saltar" onPointerDown={(e) => { e.preventDefault(); onJump(); }}><ArrowUp /></button>
        <button type="button" className="touch-control touch-action-power" aria-label="Activar poder" onPointerDown={(e) => { e.preventDefault(); onPower(); }}><Zap /></button>
        <button type="button" className="touch-control" aria-label="Cambiar personaje" onPointerDown={(e) => { e.preventDefault(); onSwap(); }}><Users /></button>
      </div>
    </nav>
  );
}
