/**
 * car-gallery.ts
 * Generador de galerías fotográficas auténticas por coche y marca para iRacing.
 * Utiliza capturas de alta definición de lanzamientos oficiales, hotlaps,
 * telemetría y banners de estudio de iRacing.
 */

import { type CarMetadata } from '../../desktop/src/cars/catalog';
import { getCarVideos } from './video-links';

export interface CarGallerySlide {
  src: string;
  title: string;
  subtitle: string;
  tag: string;
  id: string;
  downloadName?: string;
  setupsUrl?: string;
}

// Banners e imágenes de respaldo de alta fidelidad para marcas icónicas
const BRAND_HERO_MAP: Record<string, string[]> = {
  ferrari: [
    'https://i.ytimg.com/vi/cmEbLn8Ffxw/maxresdefault.jpg',
    'https://i.ytimg.com/vi/HNGkRzqpNZw/maxresdefault.jpg',
    'https://i.ytimg.com/vi/ThA117d29i0/maxresdefault.jpg',
    '/assets/img/coche1.webp',
  ],
  porsche: [
    'https://i.ytimg.com/vi/NTLCqJf8WmY/maxresdefault.jpg',
    'https://i.ytimg.com/vi/J281j1yjDqY/maxresdefault.jpg',
    'https://i.ytimg.com/vi/mWARS1lkNkk/maxresdefault.jpg',
    'https://i.ytimg.com/vi/yIeH32UHwaM/maxresdefault.jpg',
  ],
  bmw: [
    'https://i.ytimg.com/vi/C5I0ym_w0Uo/maxresdefault.jpg',
    'https://i.ytimg.com/vi/Yhivso3np6o/maxresdefault.jpg',
    'https://i.ytimg.com/vi/y4tPrUhvyeE/maxresdefault.jpg',
    'https://i.ytimg.com/vi/LZQ7SJDm_eQ/maxresdefault.jpg',
  ],
  mercedes: [
    'https://i.ytimg.com/vi/iexPUbjhec8/maxresdefault.jpg',
    'https://i.ytimg.com/vi/p6LPVB5iDE0/maxresdefault.jpg',
    'https://i.ytimg.com/vi/onEJB2zWMKg/maxresdefault.jpg',
  ],
  chevrolet: [
    'https://i.ytimg.com/vi/fz-nvXGARws/maxresdefault.jpg',
    'https://i.ytimg.com/vi/2yBpHBHm9-c/maxresdefault.jpg',
    'https://i.ytimg.com/vi/jnMNCecGjMc/maxresdefault.jpg',
  ],
  ford: [
    'https://i.ytimg.com/vi/rmYMIq_YgMU/maxresdefault.jpg',
    'https://i.ytimg.com/vi/x1syxyOR3iY/maxresdefault.jpg',
    'https://i.ytimg.com/vi/cPBP_RTnxBc/maxresdefault.jpg',
  ],
  mclaren: [
    'https://i.ytimg.com/vi/P2i443bEONY/maxresdefault.jpg',
    'https://i.ytimg.com/vi/XksUQYKTFBU/maxresdefault.jpg',
    'https://i.ytimg.com/vi/G0qoyqjHv1c/maxresdefault.jpg',
  ],
  audi: [
    'https://i.ytimg.com/vi/CQYozlbUqZQ/maxresdefault.jpg',
    'https://i.ytimg.com/vi/_Al6_HUMoMM/maxresdefault.jpg',
    'https://i.ytimg.com/vi/AR86THlLneA/maxresdefault.jpg',
  ],
  lamborghini: [
    'https://i.ytimg.com/vi/GsmKmtGfnJo/maxresdefault.jpg',
    'https://i.ytimg.com/vi/YTmglSLqhDo/maxresdefault.jpg',
    'https://i.ytimg.com/vi/4u5VtozXo5E/maxresdefault.jpg',
  ],
  toyota: [
    'https://i.ytimg.com/vi/5PCiJ2GATEM/maxresdefault.jpg',
    'https://i.ytimg.com/vi/G524DZlVrr0/maxresdefault.jpg',
    'https://i.ytimg.com/vi/HnWIyToTXbU/maxresdefault.jpg',
  ],
  mazda: [
    'https://i.ytimg.com/vi/11eXzdFgZYU/maxresdefault.jpg',
    'https://i.ytimg.com/vi/PaJGLr1g8Kw/maxresdefault.jpg',
    'https://i.ytimg.com/vi/qpXPx3BCL-w/maxresdefault.jpg',
  ],
  acura: [
    'https://i.ytimg.com/vi/J3v4Wr5afcM/maxresdefault.jpg',
    'https://i.ytimg.com/vi/yENe4024LnM/maxresdefault.jpg',
  ],
  cadillac: [
    'https://i.ytimg.com/vi/jLxU8upMjrs/maxresdefault.jpg',
    'https://i.ytimg.com/vi/O8q9KZvK8TY/maxresdefault.jpg',
  ],
  dallara: [
    'https://i.ytimg.com/vi/Jo1o6USTWM8/maxresdefault.jpg',
    'https://i.ytimg.com/vi/1yrE5vsI4ec/maxresdefault.jpg',
  ],
};

function getBrandKey(brand: string): string {
  const norm = brand.toLowerCase();
  if (norm.includes('ferrari')) return 'ferrari';
  if (norm.includes('porsche')) return 'porsche';
  if (norm.includes('bmw')) return 'bmw';
  if (norm.includes('mercedes')) return 'mercedes';
  if (norm.includes('chevy') || norm.includes('chevrolet') || norm.includes('corvette')) return 'chevrolet';
  if (norm.includes('ford')) return 'ford';
  if (norm.includes('mclaren')) return 'mclaren';
  if (norm.includes('audi')) return 'audi';
  if (norm.includes('lambo')) return 'lamborghini';
  if (norm.includes('toyota')) return 'toyota';
  if (norm.includes('mazda')) return 'mazda';
  if (norm.includes('acura')) return 'acura';
  if (norm.includes('cadillac')) return 'cadillac';
  if (norm.includes('dallara')) return 'dallara';
  return 'ferrari';
}

/**
 * Obtiene las diapositivas de la galería para un vehículo específico.
 * Garantiza que cada diapositiva pertenezca a la marca y modelo correspondiente.
 */
export function getCarGallerySlides(car: CarMetadata): CarGallerySlide[] {
  const videos = getCarVideos(car.brand, car.model, car.carClass, car.carFolder);
  const v1 = videos[0];
  const v2 = videos[1];
  const v3 = videos[2];

  const slides: CarGallerySlide[] = [];

  // 1. Foto principal de acción / lanzamiento oficial en pista
  if (v1) {
    slides.push({
      src: `https://i.ytimg.com/vi/${v1.videoId}/maxresdefault.jpg`,
      title: `${car.brand} ${car.model} · Acción Oficial en Pista`,
      subtitle: `${car.carClass} · Lanzamiento y modelado por escaneo láser oficial en iRacing`,
      tag: `${car.carClass} Oficial`,
      id: `car:${car.carFolder}:action1`,
      setupsUrl: `/garage?car=${encodeURIComponent(car.carFolder)}`,
      downloadName: `${car.carFolder}-action1.jpg`,
    });
  }

  // 2. Foto de clasificación y trazada de vértices
  if (v2) {
    slides.push({
      src: `https://i.ytimg.com/vi/${v2.videoId}/maxresdefault.jpg`,
      title: `${car.brand} ${car.model} · Puntos de Apoyo & Telemetría`,
      subtitle: `Configuración dinámica de amortiguación, control de tracción y balance de frenada`,
      tag: 'Telemetría',
      id: `car:${car.carFolder}:telemetry`,
      setupsUrl: `/garage?car=${encodeURIComponent(car.carFolder)}`,
      downloadName: `${car.carFolder}-telemetry.jpg`,
    });
  }

  // 3. Foto de carrera y habitáculo onboard
  if (v3) {
    slides.push({
      src: `https://i.ytimg.com/vi/${v3.videoId}/maxresdefault.jpg`,
      title: `${car.brand} ${car.model} · Ritmo de Carrera & Tráfico`,
      subtitle: `Sesión de stint largo, gestión térmica de gomas y lucha de posición`,
      tag: 'Carrera',
      id: `car:${car.carFolder}:race`,
      setupsUrl: `/garage?car=${encodeURIComponent(car.carFolder)}`,
      downloadName: `${car.carFolder}-race.jpg`,
    });
  }

  // 4. Banner técnico oficial de estudio
  if (car.previewImg) {
    slides.push({
      src: car.previewImg,
      title: `${car.brand} ${car.model} · Ficha de Estudio Oficial`,
      subtitle: `${car.specs} · Identificador técnico ${car.carFolder}`,
      tag: 'Estudio iRacing',
      id: `car:${car.carFolder}:studio`,
      setupsUrl: `/garage?car=${encodeURIComponent(car.carFolder)}`,
      downloadName: `${car.carFolder}-preview.webp`,
    });
  }

  return slides;
}

/**
 * Obtiene diapositivas para la página de marca.
 */
export function getBrandGallerySlides(brandName: string, cars: CarMetadata[]): CarGallerySlide[] {
  const bKey = getBrandKey(brandName);
  const heroUrls = BRAND_HERO_MAP[bKey] || BRAND_HERO_MAP.ferrari;

  const slides: CarGallerySlide[] = [];

  cars.slice(0, 4).forEach((car, idx) => {
    const vids = getCarVideos(car.brand, car.model, car.carClass, car.carFolder);
    const vidId = vids[0]?.videoId;
    const imgUrl = vidId
      ? `https://i.ytimg.com/vi/${vidId}/maxresdefault.jpg`
      : heroUrls[idx % heroUrls.length];

    slides.push({
      src: imgUrl,
      title: `${car.brand} ${car.model} · Competición Oficial`,
      subtitle: `${car.carClass} · ${car.specs} · Disponible en iRacing`,
      tag: car.carClass,
      id: `brand:${bKey}:${car.carFolder}`,
      setupsUrl: `/garage?car=${encodeURIComponent(car.carFolder)}`,
      downloadName: `${car.carFolder}-brand.jpg`,
    });
  });

  return slides;
}
