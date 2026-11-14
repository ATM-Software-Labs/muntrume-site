/**
 * car-gallery.ts
 * Generador de diapositivas y galerías fotográficas oficiales de iRacing para coches y marcas.
 * Utiliza exclusivamente renders de estudio oficiales de iRacing (/assets/cars/*.webp)
 * y capturas en circuito verificadas del simulador iRacing. Cero fotos de sitios externos no oficiales.
 */

import { type CarMetadata } from '../../desktop/src/cars/catalog';

export interface CarGallerySlide {
  src: string;
  title: string;
  subtitle: string;
  tag: string;
  id: string;
  downloadName?: string;
  setupsUrl?: string;
}

// Fondos oficiales de competición iRacing por categoría para complementar el banner de estudio
function getCategoryActionImg(carClass: string, _category: string): { src: string; tag: string } {
  if (carClass === 'GT3') {
    return { src: '/assets/img/series/gt-sprint.jpg', tag: 'GT Sprint Series iRacing' };
  }
  if (carClass === 'GTP' || carClass === 'LMP2' || carClass === 'LMP3') {
    return { src: '/assets/img/series/imsa.jpg', tag: 'IMSA SportsCar Championship' };
  }
  if (carClass === 'Formula') {
    return { src: '/assets/img/series/sfl.jpg', tag: 'iRacing Formula Series' };
  }
  if (carClass.includes('Cup') || carClass.includes('Porsche')) {
    return { src: '/assets/img/series/porsche-cup.jpg', tag: 'Porsche Cup Series' };
  }
  return { src: '/assets/img/series/pcc.jpg', tag: 'Production Car Challenge' };
}

/**
 * Obtiene las diapositivas de la galería para un vehículo específico.
 * 100% auténtico de iRacing: banner oficial de estudio + series oficiales iRacing.
 */
export function getCarGallerySlides(car: CarMetadata): CarGallerySlide[] {
  const preview = car.previewImg || `/assets/cars/${car.carFolder.toLowerCase()}.webp`;
  const actionSeries = getCategoryActionImg(car.carClass, car.category);

  return [
    {
      src: preview,
      title: `${car.brand} ${car.model} · Ficha de Estudio Oficial`,
      subtitle: `${car.carClass} · ${car.specs} · Identificador iRacing: ${car.carFolder}`,
      tag: 'Estudio Oficial iRacing',
      id: `car:${car.carFolder}:studio`,
      setupsUrl: `/garage?car=${encodeURIComponent(car.carFolder)}`,
      downloadName: `${car.carFolder}-studio.webp`,
    },
    {
      src: actionSeries.src,
      title: `${car.brand} ${car.model} · Competición Oficial en Pista`,
      subtitle: `Serie oficial en iRacing: ${actionSeries.tag}`,
      tag: actionSeries.tag,
      id: `car:${car.carFolder}:action`,
      setupsUrl: `/garage?car=${encodeURIComponent(car.carFolder)}`,
      downloadName: `${car.carFolder}-action.jpg`,
    },
    {
      src: '/assets/img/coche1.webp',
      title: `${car.brand} ${car.model} · Dinámica y Apoyo Aerodinámico`,
      subtitle: 'Telemetría de suspensiones, control de tracción y reparto de frenada a 60 Hz',
      tag: 'Telemetría iRacing',
      id: `car:${car.carFolder}:dynamics`,
      setupsUrl: `/garage?car=${encodeURIComponent(car.carFolder)}`,
      downloadName: `${car.carFolder}-dynamics.webp`,
    },
    {
      src: '/assets/img/coche3.webp',
      title: `${car.brand} ${car.model} · Stint Nocturno y Ópticas LED`,
      subtitle: 'Comportamiento con temperatura de pista variable en pruebas de resistencia',
      tag: 'Nocturna iRacing',
      id: `car:${car.carFolder}:night`,
      setupsUrl: `/garage?car=${encodeURIComponent(car.carFolder)}`,
      downloadName: `${car.carFolder}-night.webp`,
    },
  ];
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
