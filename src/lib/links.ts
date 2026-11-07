import type { Exhibitor } from './notion';

export type SocialKey =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'website'
  | 'youtube'
  | 'linkedin'
  | 'other';

export interface NormalizedSocialLink {
  platform: string;
  url: string;
  key: SocialKey;
  label: string;
  order: number;
}

const LABELS: Record<Exclude<SocialKey, 'other'>, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  website: 'Sitio web',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
};

/**
 * Enlace de WhatsApp a partir del número capturado en Notion.
 * Los números de 10 dígitos se toman como mexicanos (+52).
 */
export function getWhatsappUrl(phone: string | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');

  if (!digits) return '';

  return `https://wa.me/${digits.length === 10 ? `52${digits}` : digits}`;
}

function getSocialKey(platform: string): SocialKey {
  const normalized = platform
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

  if (normalized.includes('instagram')) return 'instagram';
  if (normalized.includes('facebook')) return 'facebook';
  if (normalized.includes('tiktok')) return 'tiktok';
  if (
    normalized.includes('website') ||
    normalized.includes('sitio web') ||
    normalized === 'web'
  ) {
    return 'website';
  }
  if (normalized.includes('youtube')) return 'youtube';
  if (normalized.includes('linkedin')) return 'linkedin';

  return 'other';
}

/** Redes sociales válidas (solo http/https), ordenadas. */
export function getSocialLinks(
  exhibitor: Pick<Exhibitor, 'socialLinks'>
): NormalizedSocialLink[] {
  return (exhibitor.socialLinks ?? [])
    .map((social): NormalizedSocialLink | null => {
      const platform = social.platform.trim();
      let url = social.url.trim();

      if (!url) return null;

      try {
        if (!/^https?:\/\//i.test(url)) {
          url = `https://${url}`;
        }

        const parsedUrl = new URL(url);

        if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
          return null;
        }

        url = parsedUrl.href;
      } catch {
        return null;
      }

      const key = getSocialKey(platform);

      return {
        platform,
        url,
        key,
        label: key === 'other' ? platform : LABELS[key],
        order: social.order ?? 999,
      };
    })
    .filter((social): social is NormalizedSocialLink => social !== null)
    .sort((a, b) => a.order - b.order);
}

/** Solo se aceptan mapas incrustados de Google Maps. */
export function getMapsEmbedUrl(url: string | undefined): string {
  const value = (url ?? '').trim();

  if (!value) return '';

  try {
    const parsed = new URL(value);

    const isGoogleEmbed =
      parsed.protocol === 'https:' &&
      /(^|\.)google\.[a-z.]+$/.test(parsed.hostname) &&
      parsed.pathname.startsWith('/maps/embed');

    return isGoogleEmbed ? parsed.href : '';
  } catch {
    return '';
  }
}
