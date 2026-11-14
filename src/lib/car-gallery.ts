/**
 * car-gallery.ts
 * Generador de diapositivas y galerías fotográficas oficiales de iRacing para coches y marcas.
 * Utiliza exclusivamente renders de estudio oficiales de iRacing (/assets/cars/*.webp)
 * y fotos verificadas cuyo carPath coincide exactamente. Cero fallbacks cruzados entre coches.
 */

import { type CarMetadata } from '../../desktop/src/cars/catalog';
import { PADDOCK_ALBUMS } from '../data/paddock-gallery';

export interface CarGallerySlide {
  src: string;
  title: string;
  subtitle: string;
  tag: string;
  id: string;
  downloadName?: string;
  setupsUrl?: string;
}

const OTHER_MANUFACTURER_KEYWORDS = [
  'ferrari', '296', '488', '499p',
  'bmw', 'm4', 'm8', 'm2',
  'mercedes', 'amg',
  'lamborghini', 'huracan',
  'audi', 'r8',
  'mclaren', '720s', '570s',
  'ford', 'mustang',
  'corvette', 'chevy', 'vette',
  'aston', 'vantage',
  'porsche', '992', '963', '911', '718',
];

function isForeignManufacturerAsset(car: CarMetadata, src: string, title = ''): boolean {
  const brandLower = car.brand.toLowerCase();
  const folderLower = car.carFolder.toLowerCase();
  const haystack = `${src} ${title}`.toLowerCase();

  // Nunca usar assets genéricos de otros coches (p. ej. coche1.webp = Ferrari 296 GT3) salvo en su propio carPath
  if (/\/assets\/img\/coche[134]\b/.test(haystack) && folderLower !== 'ferrari296gt3') {
    return true;
  }
  if (/\/assets\/img\/coche2\b/.test(haystack) && folderLower !== 'porsche992rgt3') {
    return true;
  }

  for (const kw of OTHER_MANUFACTURER_KEYWORDS) {
    if (brandLower.includes(kw) || folderLower.includes(kw)) continue;
    // Evitar falsos positivos de subcadenas cortas como 'm2'/'m4'/'r8' dentro de palabras
    const re = kw.length <= 3 ? new RegExp(`(^|[^a-z0-9])${kw}([^a-z0-9]|$)`, 'i') : new RegExp(kw, 'i');
    if (re.test(haystack)) {
      return true;
    }
  }
  return false;
}

/**
 * Obtiene las diapositivas de la galería para un vehículo específico.
 * Solo incluye fotos cuyo carPath coincide exactamente con car.carFolder.
 * Prohibido rellenar con fotos de otros coches o imágenes genéricas.
 */
export function getCarGallerySlides(car: CarMetadata): CarGallerySlide[] {
  const folderLower = car.carFolder.toLowerCase();
  const preview = car.previewImg || `/assets/cars/${folderLower}.webp`;
  const slides: CarGallerySlide[] = [
    {
      src: preview,
      title: `${car.brand} ${car.model} · Ficha de Estudio Oficial`,
      subtitle: `${car.carClass} · ${car.specs} · Identificador iRacing: ${car.carFolder}`,
      tag: 'Estudio Oficial iRacing',
      id: `car:${car.carFolder}:studio`,
      setupsUrl: `/garage?car=${encodeURIComponent(car.carFolder)}`,
      downloadName: `${car.carFolder}-studio.webp`,
    },
  ];

  const seenSrc = new Set<string>([preview.toLowerCase()]);
  const album = PADDOCK_ALBUMS.find((a) => a.carPath.toLowerCase() === folderLower);
  if (album) {
    for (const photo of album.photos) {
      if (photo.carPath.toLowerCase() !== folderLower) continue;
      if (seenSrc.has(photo.img.toLowerCase())) continue;
      if (isForeignManufacturerAsset(car, photo.img, photo.title)) continue;
      seenSrc.add(photo.img.toLowerCase());
      slides.push({
        src: photo.img,
        title: photo.title,
        subtitle: photo.subtitle || `${car.brand} ${car.model} · ${car.carFolder}`,
        tag: photo.tag || 'Oficial iRacing',
        id: photo.id,
        setupsUrl: `/garage?car=${encodeURIComponent(car.carFolder)}`,
        downloadName: `${car.carFolder}-${photo.id}.webp`,
      });
    }
  }

  return slides;
}

/**
 * Obtiene diapositivas para la página de marca.
 * Muestra exclusivamente los coches oficiales de esa marca en iRacing.
 */
export function getBrandGallerySlides(_brandName: string, cars: CarMetadata[]): CarGallerySlide[] {
  return cars.map((car) => {
    const preview = car.previewImg || `/assets/cars/${car.carFolder.toLowerCase()}.webp`;
    return {
      src: preview,
      title: `${car.brand} ${car.model} · Oficial iRacing`,
      subtitle: `${car.carClass} (${car.category}) · ${car.specs}`,
      tag: `${car.carClass} iRacing`,
      id: `brand:${car.carFolder}`,
      setupsUrl: `/garage?car=${encodeURIComponent(car.carFolder)}`,
      downloadName: `${car.carFolder}.webp`,
    };
  });
}
