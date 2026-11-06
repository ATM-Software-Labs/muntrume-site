/**
 * t265: solo identidad. Las estadísticas (iRating, licencia, coche favorito, categoría, carreras)
 * NO se escriben aquí: llegan en vivo desde /api/drivers (iRacing Data API o puente) o se muestra «Sin datos».
 */
export interface Piloto {
  slug: string;
  cust_id: number | null;
  dorsal: string;
  name: string;
  fullName: string;
  role: string;
  badge: 'FOUNDER' | 'DRIVER';
  country?: string;
  flag: string;
  flag_code: string;
  helmet_url: string | null;
  bio?: string;
  initials?: string;
}

export const PILOTOS: Piloto[] = [
  {
    slug: 'albertot',
    cust_id: 993381,
    dorsal: '#1',
    name: 'Alberto T',
    fullName: 'Alberto Trujillo',
    role: 'TEAM PRINCIPAL & TELEMETRÍA',
    badge: 'FOUNDER',
    country: 'Spain',
    flag: '🇪🇸',
    flag_code: 'ES',
    helmet_url: '/assets/img/helmet-alberto.webp',
    bio: 'Team Principal y director técnico de Muntrume Motorsport. Especialista en dinámica de vehículos, telemetría a 60 Hz y estrategias de carrera para eventos de resistencia.',
    initials: 'AT'
  },
  {
    slug: 'mateob',
    cust_id: 1134615,
    dorsal: '#2',
    name: 'Mateo B',
    fullName: 'Mateo Berbis',
    role: 'GT3 ENDURANCE',
    badge: 'DRIVER',
    country: 'Spain',
    flag: '🇪🇸',
    flag_code: 'ES',
    helmet_url: '/assets/img/helmet-mateo.webp',
    bio: 'Piloto oficial de GT3 en campeonatos de resistencia y sprint. Especialista en ritmo de carrera continuo, consistencia y gestión de tráfico en stint largo.',
    initials: 'MB'
  },
  {
    slug: 'eduardoc',
    cust_id: 1076585,
    dorsal: '#3',
    name: 'Eduardo',
    fullName: 'Eduardo Chongkan',
    role: 'PROTOTIPOS GTP',
    badge: 'DRIVER',
    country: 'Costa Rica',
    flag: '🇨🇷',
    flag_code: 'CR',
    helmet_url: '/assets/img/helmet-eduardo.webp',
    bio: 'Especialista en prototipos híbridos GTP e IMSA. Enfoque en recuperación de energía, balance aerodinámico y frenada de alta precisión.',
    initials: 'EC'
  }
];
