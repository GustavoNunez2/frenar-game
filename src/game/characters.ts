import { CharacterId, CharacterSpec } from './types';

export const INITIAL_UNLOCKED_CHARACTERS: CharacterId[] = [
  'rodolfo',
  'marcela',
];

/**
 * Catálogo completo de los 6 personajes jugables.
 * Al inicio solo Rodolfo y Marcela están desbloqueados; los demás se desbloquean
 * venciendo a cada jefe cada 3 pantallas.
 */
export const CHARACTERS: Record<CharacterId, CharacterSpec> = {
  rodolfo: {
    id: 'rodolfo',
    name: 'Rodolfo',
    role: 'Maestro de frenos y perros',
    bio: 'Pelo entrecano despeinado, cejas marcadas, reloj oscuro, remera y bermuda cargo negra con su perro blanco Felipe en la mochila.',
    powerName: 'Compañero Canino (Felipe)',
    powerDescription:
      'Felipe salta de la mochila, embiste enemigos adelante y atrás (¡y muerde jefes!) antes de volver.',
    fluidCost: 42,
    powerDuration: 5.5,
    cooldown: 6.0,
    primaryColor: '#2563EB',
    secondaryColor: '#FFFFFF',
    accentColor: '#FFE600',
    speedMultiplier: 1.0,
    jumpMultiplier: 1.0,
    unlockHint: 'Disponible desde el inicio',
  },
  marcela: {
    id: 'marcela',
    name: 'Marcela',
    role: 'Maestra guía',
    bio: 'Cabello rubio platino luminoso, anteojos oscuros y guardapolvo blanco clásico con tiza en el bolsillo.',
    powerName: 'Puente o Muralla de Tiza',
    powerDescription:
      'Dibuja un puente horizontal sobre vacíos o levanta una muralla vertical que frena enemigos y aturde embestidas de jefes.',
    fluidCost: 38,
    powerDuration: 5.5,
    cooldown: 5.0,
    primaryColor: '#FF2D87',
    secondaryColor: '#FFFFFF',
    accentColor: '#00E5FF',
    speedMultiplier: 1.0,
    jumpMultiplier: 1.02,
    unlockHint: 'Disponible desde el inicio',
  },
  micaela: {
    id: 'micaela',
    name: 'Micaela',
    role: 'Sensible, empática y dormilona',
    bio: 'Cabello castaño largo, anteojos finos, labios oscuros, top negro, pollera tableada verde/negra y Converse. Duerme en cama tras 2s quieta.',
    powerName: 'Nube de Siesta',
    powerDescription:
      'Invoca una almohada-nube pastel con "Zzz" para flotar suavemente ignorando la gravedad y caer sobre enemigos o jefes.',
    fluidCost: 40,
    powerDuration: 4.0,
    cooldown: 5.5,
    primaryColor: '#A87BFF',
    secondaryColor: '#1B5E3F',
    accentColor: '#FFD6EC',
    speedMultiplier: 0.97,
    jumpMultiplier: 1.0,
    unlockHint: 'Vence al Jefe 1 (tras 3 pantallas)',
  },
  lautaro: {
    id: 'lautaro',
    name: 'Lautaro',
    role: 'Amante de autos modificados',
    bio: 'Flequillo inclinado, sonrisa pícara, remera negra algo desalineada y pantalón cargo negro largo.',
    powerName: 'Rebobinado Tardío',
    powerDescription:
      'Aparece su Renault 19 gris planchado al piso con neones azules y retrocede ~1,5s en el tiempo para salvar errores.',
    fluidCost: 45,
    powerDuration: 0.55,
    cooldown: 6.5,
    primaryColor: '#00B4FF',
    secondaryColor: '#9CA3AF',
    accentColor: '#FFE600',
    speedMultiplier: 1.05,
    jumpMultiplier: 1.0,
    unlockHint: 'Vence al Jefe 2 (tras 6 pantallas)',
  },
  leandro: {
    id: 'leandro',
    name: 'Leandro',
    role: 'Peluquero y diseñador',
    bio: 'Degradé prolijo, flequillo recto/asimétrico, cadena plateada, remera azul grisácea con bloque verde y cargo oscuro.',
    powerName: 'Corte Limpio',
    powerDescription:
      'Tijeras y navajas plateadas giran a su alrededor en un dash horizontal invencible que corta enemigos, barreras y jefes.',
    fluidCost: 36,
    powerDuration: 0.48,
    cooldown: 5.0,
    primaryColor: '#00C9A7',
    secondaryColor: '#52796F',
    accentColor: '#FF2A85',
    speedMultiplier: 1.03,
    jumpMultiplier: 1.0,
    unlockHint: 'Vence al Jefe 3 (tras 9 pantallas)',
  },
  gustavo: {
    id: 'gustavo',
    name: 'Gustavo',
    role: 'Técnico electrónico y músico',
    bio: 'Cabello ondulado con sutiles canas, barba corta, arito, remera negra con palmera, jean gastado roto y guitarra.',
    powerName: 'Guitarra Sónica',
    powerDescription:
      'Pasa su guitarra al frente y dispara ondas sónicas vibrantes que barren enemigos a distancia.',
    fluidCost: 44,
    powerDuration: 4.2,
    cooldown: 6.0,
    primaryColor: '#9B2BFF',
    secondaryColor: '#00F5D4',
    accentColor: '#FFE600',
    speedMultiplier: 1.02,
    jumpMultiplier: 1.0,
    unlockHint: 'Vence al Jefe 4 (tras 12 pantallas)',
  },
};

export const CHARACTER_LIST: CharacterSpec[] = [
  CHARACTERS.rodolfo,
  CHARACTERS.marcela,
  CHARACTERS.micaela,
  CHARACTERS.lautaro,
  CHARACTERS.leandro,
  CHARACTERS.gustavo,
];
