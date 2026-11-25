interface FrenarLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Logo oficial "FRENAR®" en tipografía inclinada, angular y amarilla vibrante
 * con símbolo ® en círculo a la derecha y trazo oscuro/resplandor para alto contraste.
 */
export function FrenarLogo({ size = 'lg' }: FrenarLogoProps) {
  const heightClass =
    size === 'sm' ? 'h-7' : size === 'md' ? 'h-10' : 'h-12 md:h-14';

  return (
    <svg
      viewBox="0 0 360 76"
      className={`${heightClass} w-auto select-none drop-shadow-[0_0_14px_rgba(255,230,0,0.45)]`}
      role="img"
      aria-label="FRENAR®"
    >
      <defs>
        <linearGradient id="frenar-yellow-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFF566" />
          <stop offset="52%" stopColor="#FFE600" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>

      {/* Franja dinámica inferior de velocidad */}
      <polygon
        points="16,66 308,66 300,72 8,72"
        fill="#FFE600"
        stroke="#0B0F1A"
        strokeWidth="2.5"
      />

      {/* Texto principal inclinado hacia adelante y angular */}
      <g transform="skewX(-14) translate(16, 0)">
        <text
          x="12"
          y="55"
          fill="#0B0F1A"
          stroke="#0B0F1A"
          strokeWidth="11"
          strokeLinejoin="round"
          fontFamily="'Bungee', 'Arial Black', Impact, sans-serif"
          fontSize="52"
          letterSpacing="3"
        >
          FRENAR
        </text>
        <text
          x="12"
          y="55"
          fill="url(#frenar-yellow-grad)"
          stroke="#110B1E"
          strokeWidth="3.5"
          strokeLinejoin="round"
          fontFamily="'Bungee', 'Arial Black', Impact, sans-serif"
          fontSize="52"
          letterSpacing="3"
        >
          FRENAR
        </text>
      </g>

      {/* Símbolo ® encerrado en círculo a la derecha */}
      <g transform="translate(328, 24)">
        <circle
          cx="0"
          cy="0"
          r="15"
          fill="#0B0F1A"
          stroke="#FFE600"
          strokeWidth="3.2"
        />
        <text
          x="0"
          y="5.5"
          textAnchor="middle"
          fill="#FFE600"
          fontFamily="'Fredoka', Arial, sans-serif"
          fontWeight="900"
          fontSize="17"
        >
          R
        </text>
      </g>
    </svg>
  );
}
