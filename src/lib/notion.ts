import { Client } from '@notionhq/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';


export interface SocialLink {
  platform: string;
  url: string;
  order: number;
}

export interface Exhibitor {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  whatsapp: string;
  maps: string;
  maps_api: string;
  logo: string;
  images: string[];
  promo: string;
  code: string;
  socialLinks: SocialLink[];
}

type NotionFile = {
  type?: string;
  name?: string;
  file?: {
    url?: string;
  };
  external?: {
    url?: string;
  };
};

type NotionPage = {
  id: string;
  properties: Record<string, any>;
};

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_API_KEY || !DATABASE_ID) {
  throw new Error(
    'Faltan las variables de entorno requeridas para conectar con Notion.'
  );
}

const notion = new Client({
  auth: NOTION_API_KEY,
});

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

function getText(property: any): string {
  if (!property) return '';

  if (property.type === 'title' || property.title) {
    return (
      property.title
        ?.map((item: any) => item.plain_text ?? '')
        .join('') ?? ''
    );
  }

  if (property.type === 'rich_text' || property.rich_text) {
    return (
      property.rich_text
        ?.map((item: any) => item.plain_text ?? '')
        .join('') ?? ''
    );
  }

  if (property.type === 'url') {
    return property.url ?? '';
  }

  if (property.type === 'phone_number') {
    return property.phone_number ?? '';
  }

  return '';
}

function getSelect(property: any): string {
  return property?.select?.name ?? '';
}

function getUrl(property: any): string {
  if (!property) return '';

  return property.url ?? '';
}

function getSocialLinks(props: Record<string, any>): SocialLink[] {
  const platforms = [
    { property: 'Instagram', platform: 'Instagram', order: 1 },
    { property: 'Facebook', platform: 'Facebook', order: 2 },
    { property: 'Tiktok', platform: 'TikTok', order: 3 },
    { property: 'Website', platform: 'Website', order: 4 },
  ];

  return platforms
    .map(({ property, platform, order }) => ({
      platform,
      url: getUrl(props[property]).trim(),
      order,
    }))
    .filter((social) => social.url);
}

function getFiles(property: any): NotionFile[] {
  return property?.files ?? [];
}

function getFileUrl(file: NotionFile): string {
  if (file.type === 'file') {
    return file.file?.url ?? '';
  }

  if (file.type === 'external') {
    return file.external?.url ?? '';
  }

  return file.file?.url ?? file.external?.url ?? '';
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type ImageKind = 'logo' | 'image';

// Tamaño máximo (lado mayor) de cada tipo de imagen ya optimizada.
const MAX_SIZE: Record<ImageKind, number> = {
  logo: 400,
  image: 1600,
};

/**
 * Las URLs de archivos subidos a Notion están firmadas y cambian en cada
 * consulta (los parámetros de la query caducan en ~1 h). La ruta, en cambio,
 * es estable, así que el nombre del archivo se calcula solo con ella. Así la
 * misma imagen conserva su nombre entre sincronizaciones y no se descarga
 * otra vez si ya existe.
 */
function stableFilename(
  id: string,
  index: number,
  url: string,
  isNotionFile: boolean
): string {
  const parsed = new URL(url);
  const key = isNotionFile ? parsed.origin + parsed.pathname : url;

  const hash = createHash('sha256').update(key).digest('hex').slice(0, 12);

  return `${id.replace(/-/g, '')}-${index}-${hash}.webp`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fetchWithRetry(url: URL, attempts = 3): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(20_000),
      });

      if (response.ok) return response;

      // Reintentar solo errores temporales.
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`HTTP ${response.status}`);
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  throw lastError;
}

async function downloadImage(
  url: string,
  filename: string,
  kind: ImageKind
): Promise<string> {
  if (!url) return '';

  const publicPath = `/uploads/${filename}`;

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== 'https:') {
      console.warn(`Se omitió una imagen con URL no HTTPS: ${filename}`);
      return '';
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const filePath = path.join(UPLOAD_DIR, filename);

    if (await fileExists(filePath)) {
      return publicPath;
    }

    const response = await fetchWithRetry(parsedUrl);

    const contentType = response.headers.get('content-type') ?? '';

    if (!contentType.startsWith('image/')) {
      throw new Error(`Tipo de contenido no válido: ${contentType}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Evitar descargar accidentalmente archivos demasiado grandes.
    const maxBytes = 25 * 1024 * 1024;

    if (buffer.byteLength > maxBytes) {
      throw new Error('La imagen supera el límite de 25 MB.');
    }

    // Redimensionar y convertir a WebP para que el sitio cargue rápido
    // en el celular durante el evento.
    const size = MAX_SIZE[kind];

    await sharp(buffer, { animated: false })
      .rotate()
      .resize({
        width: size,
        height: size,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: kind === 'logo' ? 90 : 80 })
      .toFile(filePath);

    return publicPath;
  } catch (error) {
    console.error(`No se pudo descargar la imagen ${filename}:`, error);

    return '';
  }
}

async function downloadNotionFile(
  file: NotionFile,
  pageId: string,
  index: number,
  kind: ImageKind
): Promise<string> {
  const url = getFileUrl(file);

  if (!url) return '';

  const isNotionFile = file.type === 'file' || (!file.type && !!file.file?.url);

  let filename: string;

  try {
    filename = stableFilename(pageId, index, url, isNotionFile);
  } catch {
    console.warn(`URL de imagen no válida en la página ${pageId}`);
    return '';
  }

  return downloadImage(url, filename, kind);
}

async function getAllPages(): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];

  let startCursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: DATABASE_ID!,
      start_cursor: startCursor,
      page_size: 100,
      filter: {
        property: 'Status',
        checkbox: {
          equals: true,
        },
      },
    });

    pages.push(...(response.results as NotionPage[]));

    startCursor = response.has_more
      ? response.next_cursor ?? undefined
      : undefined;
  } while (startCursor);

  return pages;
}

export async function getExhibitors(): Promise<Exhibitor[]> {
  const pages = await getAllPages();

  const exhibitors: Exhibitor[] = [];

  for (const page of pages) {
    const props = page.properties;

    const socialLinks = getSocialLinks(props);

    const name = getText(props.Name) || 'Sin nombre';

    const requestedSlug =
      getText(props.Slug) || name;

    const logoFile = getFiles(props.Logo)[0];

    const logo = logoFile
      ? await downloadNotionFile(logoFile, page.id, 0, 'logo')
      : '';

    const productFiles = getFiles(props.Images);

    const images: string[] = [];

    for (let i = 0; i < productFiles.length; i++) {
      const imageUrl = await downloadNotionFile(
        productFiles[i],
        page.id,
        i + 1,
        'image'
      );

      if (imageUrl) {
        images.push(imageUrl);
      }
    }

    exhibitors.push({
      id: page.id,
      name,
      slug: slugify(requestedSlug) || page.id.replace(/-/g, ''),
      category: getSelect(props.Category) || 'General',
      description: getText(props.Description),
      whatsapp: getText(props.whatsapp),
      maps: getUrl(props.Maps),
      maps_api: getUrl(props.Maps_Api),
      logo,
      images,
      promo: getText(props.Promo),
      code: getText(props.Código),
      socialLinks,
    });
  }

  // Orden alfabético estable (Notion no garantiza un orden fijo).
  exhibitors.sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  );

  // Evitar que dos marcas compartan el mismo slug.
  const usedSlugs = new Set<string>();

  for (const exhibitor of exhibitors) {
    if (usedSlugs.has(exhibitor.slug)) {
      exhibitor.slug = `${exhibitor.slug}-${exhibitor.id
        .replace(/-/g, '')
        .slice(0, 8)}`;
    }

    usedSlugs.add(exhibitor.slug);
  }

  return exhibitors;
}