import exhibitorsData from '../data/exhibitors.json';

import type { Exhibitor } from './notion';

export const exhibitors = exhibitorsData as Exhibitor[];

export function getExhibitorBySlug(
  slug: string
): Exhibitor | undefined {
  return exhibitors.find((exhibitor) => exhibitor.slug === slug);
}