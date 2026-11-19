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

const INSTAGRAM_API = 'https://graph.instagram.com';
// Tokens "EA…" (EAA…, EABA…) (Instagram API con inicio de sesión de Facebook).
const FACEBOOK_API = 'https://graph.facebook.com/v23.0';
const POST_LIMIT = 12;

const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'instagram.json');
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'instagram');
const PUBLIC_DIR = '/uploads/instagram';

async function api<T>(
  endpoint: string,
  params: Record<string, string>,
  base = INSTAGRAM_API
): Promise<T> {
  const url = new URL(base + endpoint);
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

/**
 * Explica en el log qué tipo de token llegó, sin mostrarlo. Los tokens de
 * "Instagram API with Instagram Login" empiezan con "IG"; los que empiezan
 * con "EA" (EAA…, EABA…) son de Facebook y graph.instagram.com los rechaza.
 */
function describeToken(token: string): void {
  const kind = token.startsWith('IG')
    ? 'de Instagram'
    : token.startsWith('EA')
      ? 'de Facebook'
      : 'de tipo desconocido';

  // Las primeras 3 letras no permiten usar el token y ayudan a ver qué se pegó.
  console.log(`Token ${kind}, empieza con "${token.slice(0, 3)}", ${token.length} caracteres.`);

  if (!token.startsWith('IG') && !token.startsWith('EA')) {
    console.warn(
      'El token debe empezar con "IG" (o "EA" si es de Facebook). Genéralo en ' +
        'Meta for Developers y pégalo completo en INSTAGRAM_ACCESS_TOKEN.'
    );
  }
}

/**
 * Con un token de Facebook hay que saber el ID de la cuenta de Instagram.
 * Se toma de INSTAGRAM_USER_ID o de la página de Facebook vinculada.
 */
async function findInstagramId(token: string): Promise<string> {
  const fromEnv = process.env.INSTAGRAM_USER_ID?.trim();
  if (fromEnv) return fromEnv;

  // Token de página: la propia página trae su cuenta de Instagram.
  try {
    const page = await api<any>(
      '/me',
      { fields: 'instagram_business_account', access_token: token },
      FACEBOOK_API
    );
    if (page.instagram_business_account?.id) return page.instagram_business_account.id;
  } catch {
    // Es un token de usuario: se buscan sus páginas.
  }

  const pages = await api<{ data: any[] }>(
    '/me/accounts',
    { fields: 'name,instagram_business_account{id,username}', access_token: token },
    FACEBOOK_API
  );
  const linked = (pages.data ?? []).find((item) => item.instagram_business_account?.id);

  if (!linked) {
    throw new Error(
      'el token de Facebook no ve ninguna página con una cuenta de Instagram ' +
        'vinculada (faltan permisos pages_show_list e instagram_basic, o la ' +
        'cuenta no está conectada a una página)'
    );
  }

  console.log(
    `Cuenta de Instagram encontrada por la página "${linked.name}": ` +
      `@${linked.instagram_business_account.username}.`
  );
  return linked.instagram_business_account.id;
}

async function main() {
  // Quitar espacios, saltos de línea o comillas que se cuelan al pegarlo, y
  // texto de más alrededor del token ("Bearer ", "access_token=", etc.).
  const raw = process.env.INSTAGRAM_ACCESS_TOKEN?.replace(/[\s"'`]/g, '') ?? '';
  const token = raw.match(/(?:EA|IG)[A-Za-z0-9_-]{20,}/)?.[0] ?? raw;

  if (!token) {
    console.log('Sin INSTAGRAM_ACCESS_TOKEN: se usan los datos de Instagram ya guardados.');
    return;
  }

  console.log('Sincronizando Instagram...');
  describeToken(token);

  // Token de Instagram: graph.instagram.com y "me". Token de Facebook:
  // graph.facebook.com con el ID de la cuenta de Instagram.
  const isFacebook = token.startsWith('EA');
  const base = isFacebook ? FACEBOOK_API : INSTAGRAM_API;
  const user = isFacebook ? await findInstagramId(token) : 'me';

  if (!isFacebook) await refreshToken(token);

  const me = await api<any>(
    `/${user}`,
    {
      fields:
        'username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count',
      access_token: token,
    },
    base
  );

  // like_count y comments_count no siempre vienen (p. ej. si se ocultan los
  // me gusta); se piden pero son opcionales.
  const media = await api<{ data: any[] }>(
    `/${user}/media`,
    {
      fields:
        'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
      limit: String(POST_LIMIT),
      access_token: token,
    },
    base
  );

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
