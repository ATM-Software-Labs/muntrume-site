export interface Piloto {
  slug: string;
  cust_id: number | null;
  dorsal: string;
  name: string;
  fullName: string;
  role: string;
  badge: 'FOUNDER' | 'DRIVER';
  flag: string;
  flag_code: string;
  fav_category: string;
  helmet_url: string | null;
  bio?: string;
  fav_car?: string;
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
    flag: '🇪🇸',
    flag_code: 'ES',
    fav_category: 'GT3 Endurance',
    helmet_url: 'https://members-ng.iracing.com/member/GetHelmetImage?custId=993381',
    bio: 'Team Principal y director técnico de Muntrume Motorsport. Especialista en dinámica de vehículos, telemetría a 60 Hz y estrategias de carrera para eventos de resistencia.',
    fav_car: 'Porsche 911 GT3 R (992)',
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
    flag: '🇪🇸',
    flag_code: 'ES',
    fav_category: 'GT3',
    helmet_url: 'https://members-ng.iracing.com/member/GetHelmetImage?custId=1134615',
    bio: 'Piloto oficial de GT3 en campeonatos de resistencia y sprint. Especialista en ritmo de carrera continuo, consistencia y gestión de tráfico en stint largo.',
    fav_car: 'Ferrari 296 GT3',
    initials: 'MB'
  },
  {
    slug: 'eduardoc',
    cust_id: 1076585,
    dorsal: '#3',
    name: 'Eduardo C',
    fullName: 'Eduardo C',
    role: 'PROTOTIPOS GTP',
    badge: 'DRIVER',
    flag: '🇪🇸',
    flag_code: 'ES',
    fav_category: 'GTP',
    helmet_url: 'https://members-ng.iracing.com/member/GetHelmetImage?custId=1076585',
    bio: 'Especialista en prototipos híbridos GTP e IMSA. Enfoque en recuperación de energía, balance aerodinámico y frenada de alta precisión.',
    fav_car: 'Aston Martin Valkyrie GTP',
    initials: 'EC'
  },
  {
    slug: 'juanluc',
    cust_id: null,
    dorsal: '#4',
    name: 'Juanlu C',
    fullName: 'Juanlu',
    role: 'MONOPLAZAS',
    badge: 'DRIVER',
    flag: '🇪🇸',
    flag_code: 'ES',
    fav_category: 'Monoplazas',
    helmet_url: null,
    bio: 'Fundador y piloto de monoplazas en Muntrume Motorsport. Enfoque en trazado de vértices y desarrollo técnico de setup.',
    fav_car: 'Super Formula Lights',
    initials: 'JC'
  }
];
