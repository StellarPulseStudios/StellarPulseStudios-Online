/**
 * Trae el perfil de Instagram de Stellar Pulse y sus últimas publicaciones
 * con la API oficial de Instagram (Instagram API with Instagram Login).
 *
 * Corre en cada build, después de Notion. Guarda los datos en
 * src/data/instagram.json y descarga las fotos a public/uploads/instagram/,
 * porque las URLs de Instagram caducan a los pocos días.
 *
 * Necesita la variable INSTAGRAM_ACCESS_TOKEN (token de larga duración de la
 * cuenta profesional). Nunca rompe el build: si falta el token o Instagram
 * falla, conserva los últimos datos guardados y el sitio muestra la sección
 * con el botón y el QR.
 */
import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

import type { InstagramData, InstagramPost } from '../src/lib/instagram';

const API = 'https://graph.instagram.com';
const POST_LIMIT = 12;

const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'instagram.json');
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'instagram');
const PUBLIC_DIR = '/uploads/instagram';

async function api<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const url = new URL(endpoint, API);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = (await response.json().catch(() => ({}))) as any;

  if (!response.ok || body.error) {
    const message = body.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`Instagram ${endpoint}: ${message}`);
  }

  return body as T;
}

/**
 * Renueva el token para que no caduque (dura 60 días desde la última
 * renovación). Meta solo deja renovar tokens con más de 24 h, así que un
 * fallo aquí no es grave.
 */
async function refreshToken(token: string): Promise<void> {
  try {
    const result = await api<{ access_token: string; expires_in: number }>(
      '/refresh_access_token',
      { grant_type: 'ig_refresh_token', access_token: token }
    );

    const days = Math.round(result.expires_in / 86_400);

    if (result.access_token && result.access_token !== token) {
      console.warn(
        `Instagram devolvió un token nuevo (vigente ${days} días). ` +
          'Actualiza INSTAGRAM_ACCESS_TOKEN en Cloudflare con el token de ' +
          'Meta for Developers para no perder la conexión.'
      );
    } else {
      console.log(`Token de Instagram renovado: vigente ${days} días más.`);
    }
  } catch (error) {
    console.log(`No se renovó el token de Instagram (${(error as Error).message}).`);
  }
}

async function downloadImage(url: string, id: string): Promise<string> {
  const hash = createHash('sha256').update(id).digest('hex').slice(0, 10);
  const filename = `${id}-${hash}.webp`;
  const filePath = path.join(UPLOAD_DIR, filename);

  try {
    await fs.access(filePath);
    return `${PUBLIC_DIR}/${filename}`;
  } catch {
    // No existe todavía: se descarga.
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await sharp(buffer, { animated: false })
    .rotate()
    .resize({ width: 480, height: 600, fit: 'cover' })
    .webp({ quality: 78 })
    .toFile(filePath);

  return `${PUBLIC_DIR}/${filename}`;
}

async function readPrevious(): Promise<InstagramData> {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  } catch {
    return { updatedAt: null, profile: null, posts: [] };
  }
}

async function main() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();

  if (!token) {
    console.log('Sin INSTAGRAM_ACCESS_TOKEN: se usan los datos de Instagram ya guardados.');
    return;
  }

  console.log('Sincronizando Instagram...');
  await refreshToken(token);

  const me = await api<any>('/me', {
    fields:
      'username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count',
    access_token: token,
  });

  // like_count y comments_count no siempre vienen (p. ej. si se ocultan los
  // me gusta); se piden pero son opcionales.
  const media = await api<{ data: any[] }>('/me/media', {
    fields:
      'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
    limit: String(POST_LIMIT),
    access_token: token,
  });

  let picture = '';
  if (me.profile_picture_url) {
    try {
      picture = await downloadImage(me.profile_picture_url, `perfil-${me.username}`);
    } catch (error) {
      console.warn('No se pudo descargar la foto de perfil:', (error as Error).message);
    }
  }

  const posts: InstagramPost[] = [];
  for (const item of media.data ?? []) {
    const source = item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url;
    if (!source) continue;

    try {
      posts.push({
        id: item.id,
        caption: item.caption ?? '',
        type: item.media_type,
        image: await downloadImage(source, item.id),
        permalink: item.permalink,
        timestamp: item.timestamp,
        likes: typeof item.like_count === 'number' ? item.like_count : null,
        comments: typeof item.comments_count === 'number' ? item.comments_count : null,
      });
    } catch (error) {
      console.warn(`No se pudo descargar la publicación ${item.id}:`, (error as Error).message);
    }
  }

  const data: InstagramData = {
    updatedAt: new Date().toISOString(),
    profile: {
      username: me.username,
      name: me.name ?? '',
      biography: me.biography ?? '',
      website: me.website ?? '',
      picture,
      followers: me.followers_count ?? null,
      following: me.follows_count ?? null,
      posts: me.media_count ?? null,
    },
    posts,
  };

  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Instagram sincronizado: @${me.username}, ${posts.length} publicaciones.`);
}

main().catch(async (error) => {
  // No detener el build: el sitio sigue funcionando con lo último guardado.
  const previous = await readPrevious();
  console.warn(
    `No se pudo sincronizar Instagram (${error.message}). ` +
      (previous.profile
        ? 'Se conservan los datos anteriores.'
        : 'La sección se mostrará sin publicaciones.')
  );
});
