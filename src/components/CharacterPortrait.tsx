import { useEffect, useRef } from 'react';
import { drawCharacterSprite } from '../game/renderer';
import { CharacterId } from '../game/types';

interface CharacterPortraitProps {
  characterId: CharacterId;
  size?: number;
  animateWalk?: boolean;
  powerPreview?: boolean;
}

/**
 * Retrato animado en Canvas 2D reutilizando el sprite articulado HD del juego.
 */
export function CharacterPortrait({
  characterId,
  size = 84,
  animateWalk = true,
  powerPreview = false,
}: CharacterPortraitProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawCharacterSprite(ctx, characterId, {
        cx: canvas.width / 2,
        bottomY: canvas.height - 6,
        facing: 1,
        walkCycle: animateWalk ? t * 0.8 : 0,
        isMoving: animateWalk,
        onGround: true,
        vy: 0,
        time: t,
        powerActive: powerPreview,
        scale: (size - 12) / 78,
      });

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [characterId, size, animateWalk, powerPreview]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="block shrink-0"
      aria-hidden="true"
    />
  );
}
