// Datos de Instagram que deja scripts/sync-instagram.ts en cada build.
import instagramData from '../data/instagram.json';

export interface InstagramProfile {
  username: string;
  name: string;
  biography: string;
  website: string;
  picture: string;
  followers: number | null;
  following: number | null;
  posts: number | null;
}

export interface InstagramPost {
  id: string;
  caption: string;
  type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  image: string;
  permalink: string;
  timestamp: string;
  likes: number | null;
  comments: number | null;
}

export interface InstagramData {
  updatedAt: string | null;
  profile: InstagramProfile | null;
  posts: InstagramPost[];
}

export const instagram = instagramData as InstagramData;

/** Números como los muestra Instagram en español: 1,280 · 12.4 mil · 1.2 M. */
export function formatCount(value: number | null): string {
  if (value === null) return '–';
  if (value < 10_000) return value.toLocaleString('es-MX');
  if (value < 1_000_000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, '')} mil`;
  }
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')} M`;
}
