import { LEVELS } from './levels';

/**
 * Extiende el suelo final y el límite de mundo sin desplazar el portal ni
 * cambiar los obstáculos del nivel. Así la cámara puede seguir al jugador
 * después de llegar al portal y mantener la salida lejos del borde derecho.
 * Se excluyen arenas de jefe para preservar exactamente su espacio de combate.
 */
const EXIT_RUNOUT = 560;
const preparedLevels = new WeakSet<object>();

export function prepareLevelExitRunouts(): void {
  for (const level of LEVELS) {
    if (level.isBossArena || preparedLevels.has(level)) continue;

    const originalWidth = level.width;
    const terminalGround = level.platforms.filter(
      (platform) =>
        platform.kind === 'ground' &&
        platform.x + platform.w >= originalWidth - 1
    );

    if (terminalGround.length === 0) continue;

    level.width = originalWidth + EXIT_RUNOUT;
    for (const platform of terminalGround) {
      platform.w += EXIT_RUNOUT;
    }
    preparedLevels.add(level);
  }
}
