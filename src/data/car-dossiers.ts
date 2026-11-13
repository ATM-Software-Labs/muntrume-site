import type { CarMetadata } from '../../desktop/src/cars/catalog';

export interface BrandOrigin {
  flag: string;
  country: string;
  hq: string;
}

export interface RealDriverInfo {
  name: string;
  series: string;
  url: string;
}

export interface CarDossier {
  headline: string;
  powertrain: string;
  drivetrain: string;
  electronics: string;
  realDrivers: RealDriverInfo[];
  curiosities: string[];
  lapBenchmarks: Array<{ track: string; lap: string; note: string }>;
}

const WIKI_BY_DRIVER: Record<string, string> = {
  'Harry Tincknell': 'https://en.wikipedia.org/wiki/Harry_Tincknell',
  'Alex Riberas': 'https://en.wikipedia.org/wiki/Alex_Riberas',
  'Marco Sørensen': 'https://en.wikipedia.org/wiki/Marco_S%C3%B8rensen',
  'Nicki Thiim': 'https://en.wikipedia.org/wiki/Nicki_Thiim',
  'Ross Gunn': 'https://en.wikipedia.org/wiki/Ross_Gunn_(racing_driver)',
  'Alessandro Pier Guidi': 'https://en.wikipedia.org/wiki/Alessandro_Pier_Guidi',
  'Davide Rigon': 'https://en.wikipedia.org/wiki/Davide_Rigon',
  'Alessio Rovera': 'https://en.wikipedia.org/wiki/Alessio_Rovera',
  'Miguel Molina': 'https://en.wikipedia.org/wiki/Miguel_Molina_(racing_driver)',
  'Daniel Serra': 'https://en.wikipedia.org/wiki/Daniel_Serra',
  'Antonio Fuoco': 'https://en.wikipedia.org/wiki/Antonio_Fuoco',
  'James Calado': 'https://en.wikipedia.org/wiki/James_Calado',
  'Antonio Giovinazzi': 'https://en.wikipedia.org/wiki/Antonio_Giovinazzi',
  'Nicklas Nielsen': 'https://en.wikipedia.org/wiki/Nicklas_Nielsen',
  'Kévin Estre': 'https://en.wikipedia.org/wiki/K%C3%A9vin_Estre',
  'Laurens Vanthoor': 'https://en.wikipedia.org/wiki/Laurens_Vanthoor',
  'Thomas Preining': 'https://en.wikipedia.org/wiki/Thomas_Preining',
  'Richard Lietz': 'https://en.wikipedia.org/wiki/Richard_Lietz',
  'Ayhancan Güven': 'https://en.wikipedia.org/wiki/Ayhancan_G%C3%BCven',
  'Matt Campbell': 'https://en.wikipedia.org/wiki/Matt_Campbell_(racing_driver)',
  'André Lotterer': 'https://en.wikipedia.org/wiki/Andr%C3%A9_Lotterer',
  'Felipe Nasr': 'https://en.wikipedia.org/wiki/Felipe_Nasr',
  'Nick Tandy': 'https://en.wikipedia.org/wiki/Nick_Tandy',
  'Mathieu Jaminet': 'https://en.wikipedia.org/wiki/Mathieu_Jaminet',
  'Ben Barnicoat': 'https://en.wikipedia.org/wiki/Ben_Barnicoat',
  'Marvin Kirchhöfer': 'https://en.wikipedia.org/wiki/Marvin_Kirchh%C3%B6fer',
  'Rob Bell': 'https://en.wikipedia.org/wiki/Rob_Bell_(racing_driver)',
  'Tom Gamble': 'https://en.wikipedia.org/wiki/Tom_Gamble_(racing_driver)',
  'Sheldon van der Linde': 'https://en.wikipedia.org/wiki/Sheldon_van_der_Linde',
  'Dries Vanthoor': 'https://en.wikipedia.org/wiki/Dries_Vanthoor',
  'Augusto Farfus': 'https://en.wikipedia.org/wiki/Augusto_Farfus',
  'Philipp Eng': 'https://en.wikipedia.org/wiki/Philipp_Eng',
  'Maxime Martin': 'https://en.wikipedia.org/wiki/Maxime_Martin',
  'Valentino Rossi': 'https://en.wikipedia.org/wiki/Valentino_Rossi',
  'Christopher Mies': 'https://en.wikipedia.org/wiki/Christopher_Mies',
  'Frédéric Vervisch': 'https://en.wikipedia.org/wiki/Fr%C3%A9d%C3%A9ric_Vervisch',
  'Joey Hand': 'https://en.wikipedia.org/wiki/Joey_Hand',
  'Dirk Müller': 'https://en.wikipedia.org/wiki/Dirk_M%C3%BCller_(racing_driver)',
  'Dennis Olsen': 'https://en.wikipedia.org/wiki/Dennis_Olsen_(racing_driver)',
  'Raffaele Marciello': 'https://en.wikipedia.org/wiki/Raffaele_Marciello',
  'Jules Gounon': 'https://en.wikipedia.org/wiki/Jules_Gounon',
  'Maro Engel': 'https://en.wikipedia.org/wiki/Maro_Engel',
  'Maximilian Götz': 'https://en.wikipedia.org/wiki/Maximilian_G%C3%B6tz',
  'Mirko Bortolotti': 'https://en.wikipedia.org/wiki/Mirko_Bortolotti',
  'Marco Mapelli': 'https://en.wikipedia.org/wiki/Marco_Mapelli',
  'Kelvin van der Linde': 'https://en.wikipedia.org/wiki/Kelvin_van_der_Linde',
  'Antonio García': 'https://en.wikipedia.org/wiki/Antonio_Garc%C3%ADa_(racing_driver)',
  'Tommy Milner': 'https://en.wikipedia.org/wiki/Tommy_Milner',
  'Nicky Catsburg': 'https://en.wikipedia.org/wiki/Nicky_Catsburg',
  'Jan Magnussen': 'https://en.wikipedia.org/wiki/Jan_Magnussen',
  'Oliver Gavin': 'https://en.wikipedia.org/wiki/Oliver_Gavin',
  'Gianmaria Bruni': 'https://en.wikipedia.org/wiki/Gianmaria_Bruni',
  'Filipe Albuquerque': 'https://en.wikipedia.org/wiki/Filipe_Albuquerque',
  'Louis Delétraz': 'https://en.wikipedia.org/wiki/Louis_Del%C3%A9traz',
  'Tom Blomqvist': 'https://en.wikipedia.org/wiki/Tom_Blomqvist',
  'Renger van der Zande': 'https://en.wikipedia.org/wiki/Renger_van_der_Zande',
  'Sébastien Bourdais': 'https://en.wikipedia.org/wiki/S%C3%A9bastien_Bourdais',
  'Earl Bamber': 'https://en.wikipedia.org/wiki/Earl_Bamber',
  'Alex Lynn': 'https://en.wikipedia.org/wiki/Alex_Lynn',
  'Colin Braun': 'https://en.wikipedia.org/wiki/Colin_Braun',
  'Malthe Jakobsen': 'https://en.wikipedia.org/wiki/Malthe_Jakobsen',
  'Larry ten Voorde': 'https://en.wikipedia.org/wiki/Larry_ten_Voorde',
  'Bastian Buus': 'https://en.wikipedia.org/wiki/Bastian_Buus',
  'Harry King': 'https://en.wikipedia.org/wiki/Harry_King_(racing_driver)',
  'Connor Zilisch': 'https://en.wikipedia.org/wiki/Connor_Zilisch',
  'Gresham Wagner': 'https://en.wikipedia.org/wiki/Gresham_Wagner',
  'Syun Koide': 'https://en.wikipedia.org/wiki/Syun_Koide',
  'Esteban Masson': 'https://en.wikipedia.org/wiki/Esteban_Masson',
  'Tomoki Nojiri': 'https://en.wikipedia.org/wiki/Tomoki_Nojiri',
  'Ritomo Miyata': 'https://en.wikipedia.org/wiki/Ritomo_Miyata',
  'Liam Lawson': 'https://en.wikipedia.org/wiki/Liam_Lawson',
  'Andrea Kimi Antonelli': 'https://en.wikipedia.org/wiki/Andrea_Kimi_Antonelli',
  'Ollie Bearman': 'https://en.wikipedia.org/wiki/Oliver_Bearman',
  'Álex Palou': 'https://en.wikipedia.org/wiki/%C3%81lex_Palou',
  'Scott Dixon': 'https://en.wikipedia.org/wiki/Scott_Dixon',
  'Josef Newgarden': 'https://en.wikipedia.org/wiki/Josef_Newgarden',
  'Lewis Hamilton': 'https://en.wikipedia.org/wiki/Lewis_Hamilton',
  'George Russell': 'https://en.wikipedia.org/wiki/George_Russell_(racing_driver)',
  'Mario Andretti': 'https://en.wikipedia.org/wiki/Mario_Andretti',
  'Jody Scheckter': 'https://en.wikipedia.org/wiki/Jody_Scheckter',
  'Kyle Larson': 'https://en.wikipedia.org/wiki/Kyle_Larson',
  'Chase Elliott': 'https://en.wikipedia.org/wiki/Chase_Elliott',
  'Denny Hamlin': 'https://en.wikipedia.org/wiki/Denny_Hamlin',
  'Joey Logano': 'https://en.wikipedia.org/wiki/Joey_Logano',
  'Ryan Blaney': 'https://en.wikipedia.org/wiki/Ryan_Blaney',
  'Dale Earnhardt': 'https://en.wikipedia.org/wiki/Dale_Earnhardt',
  'Shane van Gisbergen': 'https://en.wikipedia.org/wiki/Shane_van_Gisbergen',
  'Brodie Kostecki': 'https://en.wikipedia.org/wiki/Brodie_Kostecki',
  'Will Brown': 'https://en.wikipedia.org/wiki/Will_Brown_(racing_driver)',
  'Donny Schatz': 'https://en.wikipedia.org/wiki/Donny_Schatz',
  'Christopher Bell': 'https://en.wikipedia.org/wiki/Christopher_Bell_(racing_driver)',
  'Brad Sweet': 'https://en.wikipedia.org/wiki/Brad_Sweet',
  'Tom Coronel': 'https://en.wikipedia.org/wiki/Tom_Coronel',
  'Mikel Azcona': 'https://en.wikipedia.org/wiki/Mikel_Azcona',
  'Norbert Michelisz': 'https://en.wikipedia.org/wiki/Norbert_Michelisz',
  'Hans-Joachim Stuck': 'https://en.wikipedia.org/wiki/Hans-Joachim_Stuck',
  'Hurley Haywood': 'https://en.wikipedia.org/wiki/Hurley_Haywood',
  'Geoff Brabham': 'https://en.wikipedia.org/wiki/Geoff_Brabham',
};

function driverEntry(name: string, series: string): RealDriverInfo {
  return {
    name,
    series,
    url: WIKI_BY_DRIVER[name] ?? `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(name)}`,
  };
}

const BRAND_ORIGINS: Record<string, BrandOrigin> = {
  Acura: { flag: '🇺🇸', country: 'Estados Unidos / Japón', hq: 'Torrance, California (HRC US)' },
  'Aston Martin': { flag: '🇬🇧', country: 'Reino Unido', hq: 'Gaydon & Silverstone (AMR)' },
  Audi: { flag: '🇩🇪', country: 'Alemania', hq: 'Neuburg an der Donau (Audi Sport)' },
  BMW: { flag: '🇩🇪', country: 'Alemania', hq: 'Múnich (BMW M Motorsport)' },
  Buick: { flag: '🇺🇸', country: 'Estados Unidos', hq: 'Detroit, Míchigan' },
  Cadillac: { flag: '🇺🇸', country: 'Estados Unidos', hq: 'Detroit / Charlotte (GM Racing)' },
  Caterham: { flag: '🇬🇧', country: 'Reino Unido', hq: 'Dartford, Kent' },
  Chevrolet: { flag: '🇺🇸', country: 'Estados Unidos', hq: 'Detroit / Concord (Pratt Miller)' },
  Dallara: { flag: '🇮🇹', country: 'Italia', hq: 'Varano de’ Melegari, Parma' },
  DIRTcar: { flag: '🇺🇸', country: 'Estados Unidos', hq: 'Concord, Carolina del Norte' },
  EuroNASCAR: { flag: '🇪🇺', country: 'Europa / Francia', hq: 'Blois (Team FJ)' },
  Ferrari: { flag: '🇮🇹', country: 'Italia', hq: 'Maranello (Attività Sportive GT)' },
  FIA: { flag: '🇫🇷', country: 'Internacional (FIA)', hq: 'París / Ginebra' },
  Ford: { flag: '🇺🇸', country: 'Estados Unidos', hq: 'Dearborn / Multimatic (Ford Performance)' },
  'Formula Vee': { flag: '🇩🇪', country: 'Alemania / EE. UU.', hq: 'Plataforma clásica Volkswagen' },
  Holden: { flag: '🇦🇺', country: 'Australia', hq: 'Port Melbourne, Victoria' },
  Honda: { flag: '🇯🇵', country: 'Japón', hq: 'Sakura / Tochigi (JAS Motorsport TCR)' },
  Hyundai: { flag: '🇰🇷', country: 'Corea del Sur', hq: 'Alzenau (Hyundai Motorsport)' },
  Lamborghini: { flag: '🇮🇹', country: 'Italia', hq: 'Sant’Agata Bolognese (Squadra Corse)' },
  Ligier: { flag: '🇫🇷', country: 'Francia', hq: 'Magny-Cours (Ligier Automotive)' },
  Lotus: { flag: '🇬🇧', country: 'Reino Unido', hq: 'Hethel, Norfolk' },
  Mazda: { flag: '🇯🇵', country: 'Japón', hq: 'Hiroshima / Irvine (Mazda Motorsports)' },
  McLaren: { flag: '🇬🇧', country: 'Reino Unido', hq: 'Woking, Surrey' },
  'Mercedes-AMG': { flag: '🇩🇪', country: 'Alemania', hq: 'Affalterbach (AMG Customer Racing)' },
  NASCAR: { flag: '🇺🇸', country: 'Estados Unidos', hq: 'Daytona Beach / Concord' },
  Nissan: { flag: '🇯🇵', country: 'Japón', hq: 'Yokohama (NISMO / NPTI)' },
  Pontiac: { flag: '🇺🇸', country: 'Estados Unidos', hq: 'Pontiac, Míchigan' },
  Porsche: { flag: '🇩🇪', country: 'Alemania', hq: 'Weissach / Flacht (Porsche Motorsport)' },
  Radical: { flag: '🇬🇧', country: 'Reino Unido', hq: 'Peterborough, Cambridgeshire' },
  Ray: { flag: '🇬🇧', country: 'Reino Unido', hq: 'Egham, Surrey (Ray Race Cars)' },
  Renault: { flag: '🇫🇷', country: 'Francia', hq: 'Dieppe / Viry-Châtillon (Alpine Racing)' },
  SCCA: { flag: '🇺🇸', country: 'Estados Unidos', hq: 'Topeka, Kansas' },
  'Skip Barber': { flag: '🇺🇸', country: 'Estados Unidos', hq: 'Lakeville, Connecticut' },
  Stock: { flag: '🇺🇸', country: 'Estados Unidos', hq: 'Plataforma Short Track Oval' },
  'Super Formula': { flag: '🇯🇵', country: 'Japón / Italia', hq: 'Tokio (JRP) · Chasis Dallara' },
  Supercars: { flag: '🇦🇺', country: 'Australia', hq: 'Gold Coast / Melbourne' },
  Toyota: { flag: '🇯🇵', country: 'Japón', hq: 'Toyota City (TOYOTA GAZOO Racing)' },
};

const CURATED_DOSSIERS: Record<string, Partial<CarDossier>> = {
  amvalkyriegtp: {
    headline: 'Monocasco de fibra de carbono con V12 atmosférico Cosworth de 6.5L y carga aerodinámica pura sin sistema híbrido MGU-K.',
    powertrain: '6.5L V12 Atmosférico Cosworth (11.000+ rpm limitadas por BoP)',
    drivetrain: 'Secuencial Xtrac de 7 velocidades · Tracción trasera',
    electronics: 'Control de tracción multibanda · Sin híbrido (LMH puro)',
    realDrivers: [
      driverEntry('Harry Tincknell', 'FIA WEC Actual'),
      driverEntry('Alex Riberas', 'FIA WEC Actual'),
      driverEntry('Marco Sørensen', 'FIA WEC Actual'),
      driverEntry('Nicki Thiim', 'FIA WEC / AMR'),
      driverEntry('Ross Gunn', 'IMSA WeatherTech'),
    ],
    curiosities: [
      'Único Hypercar moderno en WEC e IMSA que prescinde por completo de unidad eléctrica delantera o trasera, compensando con menor peso base y un V12 sin turbo.',
      'Desarrollado conjuntamente entre Aston Martin Performance Technologies, Multimatic y The Heart of Racing.',
      'Su sonido agudo por encima de las 10.000 rpm lo convierte en el prototipo más reconocible de la parrilla GTP/LMH.'
    ],
    lapBenchmarks: [
      { track: 'Spa-Francorchamps (GP)', lap: '2:01.8', note: 'Referencia IMSA/GTP carga media' },
      { track: 'Daytona Road Course', lap: '1:34.9', note: 'Trim baja carga (24h)' },
      { track: 'Sebring International', lap: '1:46.2', note: 'Setup baches / amortiguación suave' }
    ]
  },
  ferrari296gt3: {
    headline: 'Arquitectura V6 biturbo a 120° en posición central-trasera, diseñada por ORECA y Maranello para dominar la resistencia GT3.',
    powertrain: '3.0L V6 Twin-Turbo a 120° (F163CE)',
    drivetrain: 'Secuencial transversal de 6 velocidades · Levas electroactuadas',
    electronics: 'ABS Bosch M5 de competición · TC1 / TC2 independientes',
    realDrivers: [
      driverEntry('Alessandro Pier Guidi', 'FIA WEC / GTWC'),
      driverEntry('Davide Rigon', 'FIA WEC / IMSA'),
      driverEntry('Alessio Rovera', 'FIA WEC Actual'),
      driverEntry('Miguel Molina', 'FIA WEC / 24h Le Mans'),
      driverEntry('Daniel Serra', 'IMSA WeatherTech'),
      driverEntry('Antonio Fuoco', 'GTWC / 24h Daytona'),
    ],
    curiosities: [
      'Ganador absoluto de las 24 Horas de Nürburgring 2023 y las 24 Horas de Daytona 2024 (GTD Pro).',
      'Al eliminar el sistema híbrido del 296 GTB de calle, el vano motor permitió retrasar el V6 para lograr un centro de gravedad más bajo y un difusor trasero más agresivo.',
      'Es uno de los GT3 con mayor ventana de estabilidad aerodinámica en curvas rápidas como Blanchimont o 130R.'
    ],
    lapBenchmarks: [
      { track: 'Spa-Francorchamps (GP)', lap: '2:15.4', note: 'Qualy condiciones óptimas (22°C)' },
      { track: 'Monza (GP)', lap: '1:46.1', note: 'Baja carga / presión freno 56.2%' },
      { track: 'Fuji International', lap: '1:37.6', note: 'GT Sprint Open S4' }
    ]
  },
  porsche992rgt3: {
    headline: 'Motor bóxer atmosférico de 4.2L colgado detrás del eje trasero con doble horquilla delantera heredada del RSR.',
    powertrain: '4.2L Flat-6 Atmosférico (9.400 rpm)',
    drivetrain: 'Secuencial Porsche de 6 velocidades · Diferencial autoblocante mecánico',
    electronics: 'ABS Bosch Motorsport M5 · TC multi-mapa + mapa de lluvia',
    realDrivers: [
      driverEntry('Kévin Estre', 'FIA WEC / Nürburgring'),
      driverEntry('Laurens Vanthoor', 'IMSA / GTWC'),
      driverEntry('Thomas Preining', 'DTM / 24h Spa'),
      driverEntry('Richard Lietz', 'FIA WEC Actual'),
      driverEntry('Ayhancan Güven', 'DTM / GTWC'),
      driverEntry('Matt Campbell', 'IMSA / Bathurst 12h'),
    ],
    curiosities: [
      'Primera generación del 911 GT3 R en incrementar la cilindrada hasta los 4.194 cc para mejorar la entrega de par a medio régimen.',
      'El radiador central único y el suelo completamente plano bajo el habitáculo maximizan el flujo hacia el alerón trasero tipo cuello de cisne.',
      'En tracción a la salida de horquillas lentas y en pista húmeda sigue siendo la referencia mecánica de la clase GT3.'
    ],
    lapBenchmarks: [
      { track: 'Spa-Francorchamps (GP)', lap: '2:15.5', note: 'Alta tracción en La Source y Bus Stop' },
      { track: 'Nürburgring Nordschleife', lap: '7:54.8', note: 'Setup VLN / NEC' },
      { track: 'Interlagos', lap: '1:30.9', note: 'Sector técnico S2 optimizado' }
    ]
  },
  mclaren720sgt3: {
    headline: 'Monocasco MonoCage II de carbono ultraligero con V8 biturbo de 4.0L y eficiencia aerodinámica de referencia en curva rápida.',
    powertrain: '4.0L V8 Twin-Turbo (M840T)',
    drivetrain: 'Secuencial de 6 velocidades · Tracción trasera',
    electronics: 'ABS / TC Bosch Motorsport ajustable desde volante',
    realDrivers: [
      driverEntry('Ben Barnicoat', 'GTWC / IMSA'),
      driverEntry('Marvin Kirchhöfer', 'GTWC Endurance'),
      driverEntry('Rob Bell', 'British GT / GTWC'),
      driverEntry('Tom Gamble', 'FIA WEC / IMSA'),
    ],
    curiosities: [
      'La versión EVO estrenada en 2023 incorporó un splitter delantero de liberación rápida y conductos de refrigeración rediseñados para el tráfico en resistencia.',
      'Gracias a su bajísima resistencia al avance y al monocasco de carbono, destaca en circuitos con largas rectas combinadas con apoyos rápidos como Silverstone o Spa.'
    ],
    lapBenchmarks: [
      { track: 'Silverstone (GP)', lap: '1:57.6', note: 'Estabilidad en Maggotts-Becketts' },
      { track: 'Spa-Francorchamps (GP)', lap: '2:15.6', note: 'Velocidad punta en Kemmel' }
    ]
  },
  bmwm4gt3: {
    headline: 'Seis cilindros en línea biturbo P58 de gran par motor, chasis largo y estabilidad sobresaliente sobre pianos agresivos.',
    powertrain: '3.0L Inline-6 Twin-Turbo (P58)',
    drivetrain: 'Xtrac secuencial de 6 velocidades · Eje trasero reforzado',
    electronics: 'Volante Fanatec oficial integrado · ABS/TC 10 etapas',
    realDrivers: [
      driverEntry('Valentino Rossi', 'FIA WEC / GTWC'),
      driverEntry('Sheldon van der Linde', 'DTM / GTWC'),
      driverEntry('Dries Vanthoor', 'FIA WEC / GTWC'),
      driverEntry('Augusto Farfus', 'FIA WEC Actual'),
      driverEntry('Philipp Eng', 'IMSA WeatherTech'),
      driverEntry('Maxime Martin', 'FIA WEC / GTWC'),
    ],
    curiosities: [
      'Su volante real fue diseñado conjuntamente con Fanatec para funcionar tanto en el coche de carreras GT3 como en simuladores.',
      'Su larga distancia entre ejes lo convierte en uno de los coches más dóciles al atacar los pianos altos de Imola, Monza o Barcelona.'
    ],
    lapBenchmarks: [
      { track: 'Imola', lap: '1:40.8', note: 'Excelente absorción en Variante Alta' },
      { track: 'Watkins Glen', lap: '1:43.7', note: 'Estabilidad en las Esses' }
    ]
  },
  fordmustanggt3: {
    headline: 'V8 Coyote atmosférico de 5.4L preparado por M-Sport y chasis Multimatic con presencia imponente en IMSA y WEC.',
    powertrain: '5.4L V8 Atmosférico Coyote (M-Sport)',
    drivetrain: 'Transaxle secuencial de 6 velocidades',
    electronics: 'ABS Bosch M5 · TC multi-mapa',
    realDrivers: [
      driverEntry('Christopher Mies', 'IMSA / 24h Daytona'),
      driverEntry('Frédéric Vervisch', 'IMSA WeatherTech'),
      driverEntry('Joey Hand', 'IMSA GTD Pro'),
      driverEntry('Dirk Müller', 'IMSA / Le Mans'),
      driverEntry('Dennis Olsen', 'FIA WEC Actual'),
    ],
    curiosities: [
      'Primer Ford Mustang homologado bajo normativa FIA GT3 para competir en las 24 Horas de Le Mans y en IMSA GTD Pro.',
      'Ganó las 24 Horas de Daytona 2025 en GTD Pro con Multimatic Motorsports.'
    ],
    lapBenchmarks: [
      { track: 'Daytona Road Course', lap: '1:44.9', note: 'Tracción en salida del Bus Stop' },
      { track: 'Sebring International', lap: '1:59.6', note: 'Estabilidad en T1 y T17' }
    ]
  },
  porsche963gtp: {
    headline: 'Prototipo LMDh híbrido con chasis Multimatic, V8 biturbo derivado del 918 Spyder y el palmarés más sólido de IMSA.',
    powertrain: '4.6L V8 Twin-Turbo + Sistema Híbrido Bosch/Williams (680 CV comb.)',
    drivetrain: 'Xtrac secuencial 7 velocidades · Freno regenerativo MGU-K trasero',
    electronics: 'Brake-by-Wire trasero · Gestión automática de energía por vuelta',
    realDrivers: [
      driverEntry('Kévin Estre', 'FIA WEC Actual'),
      driverEntry('Laurens Vanthoor', 'FIA WEC Actual'),
      driverEntry('André Lotterer', 'FIA WEC / Le Mans'),
      driverEntry('Felipe Nasr', 'IMSA WeatherTech'),
      driverEntry('Nick Tandy', 'IMSA WeatherTech'),
      driverEntry('Mathieu Jaminet', 'IMSA WeatherTech'),
    ],
    curiosities: [
      'Campeón absoluto de las 24 Horas de Daytona 2024 y 2025 con Porsche Penske Motorsport.',
      'Su bloque V8 a 90° proviene directamente de la arquitectura del Porsche RS Spyder LMP2 y del 918 Spyder de calle.'
    ],
    lapBenchmarks: [
      { track: 'Suzuka International', lap: '1:43.2', note: 'IMSA Series carga media-alta' },
      { track: 'Daytona Road Course', lap: '1:34.6', note: 'Trim 24h Daytona' }
    ]
  },
  ferrari499p: {
    headline: 'Le Mans Hypercar bicampeón de La Sarthe con chasis de carbono Maranello, V6 biturbo e híbrido en el eje delantero.',
    powertrain: '3.0L V6 Twin-Turbo + ERS delantero (>190 km/h)',
    drivetrain: 'Secuencial 7 velocidades · Tracción total temporal por encima de 190 km/h',
    electronics: 'ERS delantero activo · Brake-by-Wire en ambos ejes',
    realDrivers: [
      driverEntry('Alessandro Pier Guidi', 'FIA WEC / Le Mans'),
      driverEntry('James Calado', 'FIA WEC / Le Mans'),
      driverEntry('Antonio Giovinazzi', 'FIA WEC / Le Mans'),
      driverEntry('Antonio Fuoco', 'FIA WEC / Le Mans'),
      driverEntry('Miguel Molina', 'FIA WEC / Le Mans'),
      driverEntry('Nicklas Nielsen', 'FIA WEC / Le Mans'),
    ],
    curiosities: [
      'Ganador absoluto de las 24 Horas de Le Mans en 2023 (centenario) y 2024 con AF Corse.',
      'El motor V6 actúa como elemento portante del chasis, prescindiendo de subchasis trasero auxiliar.'
    ],
    lapBenchmarks: [
      { track: 'Le Mans (La Sarthe)', lap: '3:23.9', note: 'Velocidad en Mulsanne con ERS' },
      { track: 'Spa-Francorchamps (GP)', lap: '2:01.4', note: 'Tracción total en salida de Raidillon' }
    ]
  },
  cadillacvseriesrgtp: {
    headline: 'V8 atmosférico de 5.5L con cigüeñal plano y sonido gutural inconfundible en FIA WEC e IMSA GTP.',
    powertrain: '5.5L V8 Atmosférico DOHC + Híbrido LMDh (680 CV comb.)',
    drivetrain: 'Xtrac secuencial 7 velocidades · Chasis Dallara',
    electronics: 'Brake-by-Wire trasero · Gestión híbrida LMDh',
    realDrivers: [
      driverEntry('Earl Bamber', 'FIA WEC Actual'),
      driverEntry('Alex Lynn', 'FIA WEC Actual'),
      driverEntry('Sébastien Bourdais', 'IMSA / WEC'),
      driverEntry('Renger van der Zande', 'IMSA WeatherTech'),
    ],
    curiosities: [
      'Su V8 atmosférico de 5.5 litros y 8.800 rpm genera una resonancia característica al salir de boxes en modo eléctrico y arrancar el motor térmico.',
      'Construido sobre chasis Dallara, ha logrado poles en las 24 Horas de Le Mans y victorias en IMSA.'
    ],
    lapBenchmarks: [
      { track: 'Suzuka International', lap: '1:43.4', note: 'IMSA GTP Open' },
      { track: 'Daytona Road Course', lap: '1:34.7', note: 'Trim 24h Daytona' }
    ]
  },
  porsche9922cup: {
    headline: 'La copa monomarca más pura del paddock: 510 CV bóxer sin ABS ni control de tracción (en configuración clásica Cup).',
    powertrain: '4.0L Flat-6 Atmosférico (510 CV)',
    drivetrain: 'Secuencial Porsche 6 velocidades con levas',
    electronics: 'Sensibilidad directa de pedal · Control puro del piloto',
    realDrivers: [
      driverEntry('Larry ten Voorde', 'Porsche Supercup'),
      driverEntry('Bastian Buus', 'Porsche Supercup'),
      driverEntry('Harry King', 'Porsche Supercup'),
    ],
    curiosities: [
      'Protagonista de la Porsche Mobil 1 Supercup (telonera de la F1) y decenas de Porsche Carrera Cup nacionales.',
      'En iRacing es uno de los mejores termómetros para medir la técnica de trail-braking y modulación del gas.'
    ],
    lapBenchmarks: [
      { track: 'Long Beach Street Circuit', lap: '1:18.9', note: 'Porsche Cup S4 Week 9' },
      { track: 'Spa-Francorchamps (GP)', lap: '2:17.2', note: 'Referencia Supercup' }
    ]
  },
  mx5cup: {
    headline: 'Chasis ligero ND2 con diferencial Torsen y caja secuencial Sadev: la escuela universal del rebufo y el momentum en iRacing.',
    powertrain: '2.0L Skyactiv-G 4 cilindros atmosférico (181 CV)',
    drivetrain: 'Secuencial Sadev de 6 velocidades · Tracción trasera',
    electronics: 'ABS de serie · Sin control de tracción en carrera',
    realDrivers: [
      driverEntry('Connor Zilisch', 'IMSA MX-5 Cup / NASCAR'),
      driverEntry('Gresham Wagner', 'IMSA MX-5 Cup'),
    ],
    curiosities: [
      'La Idemitsu Mazda MX-5 Cup real ofrece algunas de las llegadas más apretadas de todo el motorsport norteamericano, a menudo decididas por milésimas.',
      'En iRacing encabeza históricamente el número de splits horarios gracias a sus carreras cuerpo a cuerpo.'
    ],
    lapBenchmarks: [
      { track: 'Road Atlanta', lap: '1:34.2', note: 'Sim-Lab PCC / Advanced MX-5' },
      { track: 'Lime Rock Park', lap: '0:57.8', note: 'Referencia momentum puro' }
    ]
  },
  superformulalights324: {
    headline: 'Monoplaza Dallara 324 ligero con motor Spiess de tres cilindros turbo, alta carga aerodinámica y paso directo a la Super Formula.',
    powertrain: '1.6L 3 cilindros Turbo (Tomei / Spiess)',
    drivetrain: 'Secuencial 6 velocidades · Tracción trasera',
    electronics: 'Sin ABS ni TC · Push-to-Pass según reglamento',
    realDrivers: [
      driverEntry('Syun Koide', 'Super Formula Lights'),
      driverEntry('Esteban Masson', 'Super Formula Lights / WEC'),
      driverEntry('Ritomo Miyata', 'Super Formula / WEC Histórica'),
    ],
    curiosities: [
      'Sustituyó al Dallara 320 en Japón en 2024 adoptando el chasis de nueva generación Dallara 324 con Halo de titanio.',
      'Su enorme paso por curva rápida lo convierte en el monoplaza Clase C más concurrido de iRacing.'
    ],
    lapBenchmarks: [
      { track: 'Mount Panorama (Bathurst)', lap: '1:55.1', note: 'Super Formula Lights S4 Week 9' },
      { track: 'Suzuka International', lap: '1:49.8', note: 'Alta velocidad en las Esses' }
    ]
  },
  formulair04: {
    headline: 'Monoplaza FIA Fórmula 4 Tatuus de acceso internacional: equilibrio neutro, suelo plano y frenada de referencia sin ayudas.',
    powertrain: '1.4L / 2.0L FIA F4 homologado (~160-180 CV)',
    drivetrain: 'Secuencial Sadev de 6 velocidades',
    electronics: 'Sin ABS ni control de tracción',
    realDrivers: [
      driverEntry('Andrea Kimi Antonelli', 'FIA F4 / Fórmula 1'),
      driverEntry('Ollie Bearman', 'FIA F4 / Fórmula 1'),
    ],
    curiosities: [
      'Casi todos los pilotos actuales de Fórmula 1 y F2 iniciaron su transición del karting a los monoplazas en chasis FIA F4.',
      'En iRacing sirve de columna vertebral para los Regional Tours FIA F4 en Europa, América y Asia-Pacífico.'
    ],
    lapBenchmarks: [
      { track: 'Circuit de Lédenon', lap: '1:18.4', note: 'FIA F4 Europe Week 9' },
      { track: 'Spa-Francorchamps (GP)', lap: '2:20.6', note: 'Rebufo clave en Kemmel' }
    ]
  },
};

export function getBrandOrigin(brand: string): BrandOrigin {
  return BRAND_ORIGINS[brand] ?? { flag: '🏁', country: 'Internacional', hq: 'Competición Oficial iRacing' };
}

export function getCarDossier(car: CarMetadata): CarDossier {
  const key = car.carFolder.toLowerCase().replace(/[^a-z0-9]/g, '');
  const curated = CURATED_DOSSIERS[key] ?? {};

  const classDefaults: Record<string, CarDossier> = {
    GTP: {
      headline: `Prototipo ${car.brand} de máxima categoría GTP/Hypercar con carga aerodinámica activa por efecto suelo y gestión híbrida.`,
      powertrain: car.specs || 'Motor de competición híbrido LMDh / LMH',
      drivetrain: 'Secuencial de 7 velocidades · Tracción trasera',
      electronics: 'Brake-by-Wire · Gestión energética ERS/MGU-K · TC multi-mapa',
      realDrivers: [
        driverEntry('Kévin Estre', 'FIA WEC Actual'),
        driverEntry('Felipe Nasr', 'IMSA WeatherTech'),
        driverEntry('Sébastien Bourdais', 'IMSA / WEC Histórica'),
        driverEntry('Renger van der Zande', 'IMSA WeatherTech'),
      ],
      curiosities: [
        `Homologado para competir en la clase reina de resistencia (IMSA GTP / FIA WEC) sobre los circuitos más exigentes del calendario.`,
        `Su paquete aerodinámico de baja resistencia permite superar los 320 km/h en recta manteniendo un paso por curva de alta velocidad.`
      ],
      lapBenchmarks: [
        { track: 'Suzuka International', lap: '1:43.5', note: 'Referencia IMSA Open' },
        { track: 'Daytona Road Course', lap: '1:34.8', note: 'Trim baja carga' }
      ]
    },
    LMP2: {
      headline: `Prototipo LMP2 de fibra de carbono con relación peso/potencia extrema y frenada tardía de referencia en multiclase.`,
      powertrain: car.specs || 'V8 atmosférico de resistencia',
      drivetrain: 'Xtrac secuencial de 6 velocidades · Tracción trasera',
      electronics: 'Control de tracción ajustable · Sin ABS',
      realDrivers: [
        driverEntry('Filipe Albuquerque', 'WEC Histórica / IMSA'),
        driverEntry('Louis Delétraz', 'IMSA / ELMS'),
        driverEntry('Tom Blomqvist', 'IMSA WeatherTech'),
      ],
      curiosities: [
        `Pilar de las parrillas multiclase de IMSA y Le Mans, equilibrando agilidad en curva rápida con adelantamientos constantes a GT3.`,
        `Su monocasco de carbono ofrece una respuesta directa al volante ideal para el trabajo de telemetría en Garage 61.`
      ],
      lapBenchmarks: [
        { track: 'Suzuka International', lap: '1:48.9', note: 'IMSA LMP2 Open' },
        { track: 'Sebring International', lap: '1:50.2', note: '12h Endurance' }
      ]
    },
    LMP3: {
      headline: `Prototipo de acceso LMP3 con V8 atmosférico Nissan/VK56, ideal para dominar la gestión del tráfico y los prototipos.`,
      powertrain: car.specs || '5.6L V8 Atmosférico (VK56)',
      drivetrain: 'Xtrac secuencial de 6 velocidades · Tracción trasera',
      electronics: 'Control de tracción · Sin ABS',
      realDrivers: [
        driverEntry('Malthe Jakobsen', 'ELMS / FIA WEC'),
        driverEntry('Colin Braun', 'IMSA WeatherTech'),
      ],
      curiosities: [
        `Protagonista del Sports Car Challenge junto a los GT4, exigiendo precisión en frenada al carecer de ABS.`,
        `Su postura de conducción desplazada y pilares delanteros característicos replican con fidelidad el coche real de ACO/IMSA.`
      ],
      lapBenchmarks: [
        { track: 'Mobility Resort Motegi', lap: '1:49.4', note: 'LMP3 Trophy / SCC' }
      ]
    },
    GT3: {
      headline: `Gran Turismo FIA GT3 de ${car.brand} con aerodinámica optimizada para sprint y resistencia de 24 horas.`,
      powertrain: car.specs || 'Motor de competición FIA GT3',
      drivetrain: 'Secuencial de 6 velocidades · Tracción trasera',
      electronics: 'ABS Bosch de competición · Control de tracción multibanda',
      realDrivers: [
        driverEntry('Raffaele Marciello', 'FIA WEC / GTWC'),
        driverEntry('Jules Gounon', 'FIA WEC / GTWC'),
        driverEntry('Mirko Bortolotti', 'FIA WEC / DTM'),
        driverEntry('Antonio García', 'IMSA WeatherTech'),
        driverEntry('Nicky Catsburg', 'IMSA / 24h Le Mans'),
      ],
      curiosities: [
        `Diseñado bajo la normativa global FIA GT3 con Balance of Performance (BoP) para garantizar igualdad entre fabricantes.`,
        `Compatible con las series GT Sprint, GT Endurance e IMSA en iRacing.`
      ],
      lapBenchmarks: [
        { track: 'Spa-Francorchamps (GP)', lap: '2:15.8', note: 'Referencia GT3 Open' },
        { track: 'Fuji International', lap: '1:37.9', note: 'GT Sprint Series' }
      ]
    },
    GT4: {
      headline: `GT4 derivado de producción de ${car.brand}: menor carga aerodinámica, transferencias de peso nobles y batallas cerradas.`,
      powertrain: car.specs || 'Motor derivado de producción homologado SRO GT4',
      drivetrain: 'Secuencial / DCT de competición · Tracción trasera',
      electronics: 'ABS y Control de Tracción de competición',
      realDrivers: [
        driverEntry('Ross Gunn', 'IMSA Michelin Pilot'),
        driverEntry('Matt Campbell', 'SRO GT4 / Endurance'),
      ],
      curiosities: [
        `Mantiene la silueta y chasis base del modelo de calle, premiando la suavidad de volante y el cuidado del neumático delantero.`,
        `Categoría clave en el Falken Tyre Sports Car Challenge.`
      ],
      lapBenchmarks: [
        { track: 'Mobility Resort Motegi', lap: '1:58.6', note: 'GT4 Falken Tyre Challenge' }
      ]
    },
    GTE: {
      headline: `GT Endurance de pura raza sin ABS: máxima carga aerodinámica de gran turismo y frenada al límite del bloqueo.`,
      powertrain: car.specs || 'Motor homologado ACO LM GTE',
      drivetrain: 'Secuencial de 6 velocidades · Tracción trasera',
      electronics: 'Control de tracción ajustable · Sin ABS',
      realDrivers: [
        driverEntry('Gianmaria Bruni', 'WEC Histórica / Le Mans'),
        driverEntry('Richard Lietz', 'WEC Histórica / Le Mans'),
        driverEntry('Oliver Gavin', 'IMSA / Le Mans Histórica'),
        driverEntry('Jan Magnussen', 'IMSA / Le Mans Histórica'),
      ],
      curiosities: [
        `Representa la era dorada de los GTE en Le Mans y Daytona, con mayor potencia y downforce que un GT3 actual.`,
        `La ausencia de ABS exige una calibración milimétrica del reparto de frenada (Brake Bias).`
      ],
      lapBenchmarks: [
        { track: 'Le Mans (La Sarthe)', lap: '3:48.5', note: 'Referencia GTE Endurance' }
      ]
    },
    Formula: {
      headline: `Monoplaza de ruedas descubiertas con geometría de suspensión expuesta, respuesta instantánea y lectura pura del agarre.`,
      powertrain: car.specs || 'Motor de competición Open-Wheel',
      drivetrain: 'Secuencial de competición · Tracción trasera',
      electronics: 'Sin ABS ni control de tracción',
      realDrivers: [
        driverEntry('Álex Palou', 'IndyCar'),
        driverEntry('Scott Dixon', 'IndyCar'),
        driverEntry('Tomoki Nojiri', 'Super Formula'),
        driverEntry('Liam Lawson', 'Super Formula / F1'),
        driverEntry('Mario Andretti', 'F1 / IndyCar Histórica'),
      ],
      curiosities: [
        `El comportamiento aerodinámico limpio y la sensibilidad a las alturas del suelo (ride height) hacen que el setup marque la diferencia en curva rápida.`
      ],
      lapBenchmarks: [
        { track: 'Suzuka International', lap: '1:49.5', note: 'Referencia Open-Wheel' }
      ]
    },
    Oval: {
      headline: `Stock Car / Oval de ${car.brand} preparado para tráfico en rebufo (drafting), desgaste asimétrico de neumáticos y estrategia en pit lane.`,
      powertrain: car.specs || 'V8 / Motor de competición Oval',
      drivetrain: 'Caja secuencial / 4-5 velocidades · Eje trasero preparado para peralte',
      electronics: 'Sin ayudas electrónicas · Ajuste de Track Bar / Brake Bias en cabina',
      realDrivers: [
        driverEntry('Kyle Larson', 'NASCAR Cup Series'),
        driverEntry('Chase Elliott', 'NASCAR Cup Series'),
        driverEntry('Denny Hamlin', 'NASCAR Cup Series'),
        driverEntry('Joey Logano', 'NASCAR Cup Series'),
        driverEntry('Dale Earnhardt', 'NASCAR Histórica'),
      ],
      curiosities: [
        `La puesta a punto asimétrica (cross-weight, presiones derechas vs izquierdas y camber) define la velocidad en tanda larga.`
      ],
      lapBenchmarks: [
        { track: 'Kansas Speedway', lap: '0:30.4', note: 'NASCAR Open Series' }
      ]
    },
    Dirt: {
      headline: `Máquina de tierra DIRTcar diseñada para rodar de costado, modular el acelerador y leer la evolución del carril con agarre (cushion).`,
      powertrain: car.specs || 'V8 / Motor Dirt Track de alto par',
      drivetrain: 'Transmisión directa / 2-4 velocidades · Eje rígido',
      electronics: 'Control mecánico puro por acelerador y contra-volante',
      realDrivers: [
        driverEntry('Kyle Larson', 'World of Outlaws / Chili Bowl'),
        driverEntry('Donny Schatz', 'World of Outlaws'),
        driverEntry('Brad Sweet', 'World of Outlaws'),
        driverEntry('Christopher Bell', 'Chili Bowl / NASCAR'),
      ],
      curiosities: [
        `La superficie dinámica de iRacing cambia vuelta a vuelta formando un carril húmedo de máximo agarre en el exterior.`
      ],
      lapBenchmarks: [
        { track: 'Eldora Speedway', lap: '0:13.8', note: 'Carril alto (Cushion)' }
      ]
    },
    Touring: {
      headline: `Turismo de competición con batallas puerta con puerta, transferencia de pesos marcada y aprovechamiento máximo de los pianos.`,
      powertrain: car.specs || 'Motor de turismo 4 cilindros / TCR',
      drivetrain: 'Secuencial 6 velocidades',
      electronics: 'Diferencial autoblocante mecánico / electrónico',
      realDrivers: [
        driverEntry('Mikel Azcona', 'FIA TCR World Tour'),
        driverEntry('Norbert Michelisz', 'FIA TCR World Tour'),
        driverEntry('Tom Coronel', 'TCR / WTCR Histórica'),
        driverEntry('Shane van Gisbergen', 'Supercars / NASCAR'),
      ],
      curiosities: [
        `Ideal para carreras cortas muy disputadas donde el rebufo y la colocación en frenada deciden la victoria.`
      ],
      lapBenchmarks: [
        { track: 'Road Atlanta', lap: '1:33.5', note: 'Turismos / PCC' }
      ]
    },
    Prototype: {
      headline: `Prototipo ligero de chasis tubular o monocasco con relación peso/potencia espectacular y frenada muy tardía.`,
      powertrain: car.specs || 'Motor de competición ligero de altas revoluciones',
      drivetrain: 'Secuencial 6 velocidades · Tracción trasera',
      electronics: 'Sin ABS',
      realDrivers: [
        driverEntry('Hans-Joachim Stuck', 'IMSA GTO / Le Mans Histórica'),
        driverEntry('Hurley Haywood', 'IMSA / Le Mans Histórica'),
        driverEntry('Geoff Brabham', 'IMSA GTP Histórica'),
      ],
      curiosities: [
        `Combina el tacto de un monoplaza con carrocería cerrada o barchetta.`
      ],
      lapBenchmarks: [
        { track: 'Spa-Francorchamps (GP)', lap: '2:12.4', note: 'Referencia Prototipo' }
      ]
    }
  };

  const base = classDefaults[car.carClass] ?? classDefaults.GT3;
  return {
    headline: curated.headline ?? base.headline,
    powertrain: curated.powertrain ?? base.powertrain,
    drivetrain: curated.drivetrain ?? base.drivetrain,
    electronics: curated.electronics ?? base.electronics,
    realDrivers: curated.realDrivers ?? base.realDrivers,
    curiosities: curated.curiosities ?? base.curiosities,
    lapBenchmarks: curated.lapBenchmarks ?? base.lapBenchmarks,
  };
}
