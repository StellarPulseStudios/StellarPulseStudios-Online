import exhibitorsData from '../data/exhibitors.json';

import type { Exhibitor, ImageSize } from './notion';

// Los datos sincronizados antes de guardar medidas no traen `imageSizes`.
export const exhibitors = (exhibitorsData as Partial<Exhibitor>[]).map(
  (item) => ({ imageSizes: {}, ...item }) as Exhibitor
);

export function getExhibitorBySlug(
  slug: string
): Exhibitor | undefined {
  return exhibitors.find((exhibitor) => exhibitor.slug === slug);
}

/** Atributos width/height para evitar saltos de la página al cargar. */
export function imageSize(
  exhibitor: Exhibitor,
  src: string
): Partial<ImageSize> {
  return exhibitor.imageSizes[src] ?? {};
}
