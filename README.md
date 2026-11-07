# Stellar Pulse · Directorio de emprendimientos

Sitio estático con los emprendimientos participantes de Stellar Pulse.
Los datos se capturan en una base de datos de **Notion**, el sitio se genera
con **Astro** y se publica en **Cloudflare Pages**.

```
Notion ──(sync en cada build)──▶ src/data/exhibitors.json + public/uploads/*.webp ──▶ Astro ──▶ Cloudflare Pages
```

## Desarrollo local

Requiere Node 22.

```sh
npm install
cp .env.example .env   # y completa las variables
npm run sync:notion    # descarga datos e imágenes de Notion
npm run dev            # http://localhost:4321
```

`npm run build` hace la sincronización y luego genera el sitio en `dist/`.

### Variables de entorno

| Variable             | Para qué sirve                                                 |
| :------------------- | :------------------------------------------------------------- |
| `NOTION_API_KEY`     | Token de la integración interna de Notion.                     |
| `NOTION_DATABASE_ID` | ID de la base de datos de emprendimientos.                     |
| `SITE_URL`           | Dominio público (sitemap, URL canónica, vista previa en redes). |

## Base de datos de Notion

Solo se publican las filas con la casilla **Status** marcada.

| Propiedad                                    | Tipo            | Notas                                                  |
| :------------------------------------------- | :-------------- | :----------------------------------------------------- |
| `Name`                                       | Título          | Nombre del emprendimiento.                             |
| `Slug`                                       | Texto           | Opcional. Si está vacío se genera a partir del nombre. |
| `Category`                                   | Selección       | Se usa para los filtros del directorio.                |
| `Description`                                | Texto           |                                                        |
| `Logo`                                       | Archivos        | Se usa el primero.                                     |
| `Images`                                     | Archivos        | Galería de productos.                                  |
| `whatsapp`                                   | Texto/teléfono  | 10 dígitos se toman como número de México (+52).       |
| `Instagram`, `Facebook`, `Tiktok`, `Website` | URL             |                                                        |
| `Maps`                                       | URL             | Enlace para abrir Google Maps.                         |
| `Maps_Api`                                   | URL             | URL de "Insertar un mapa" de Google Maps.              |
| `Promo`, `Código`                            | Texto           |                                                        |
| `Status`                                     | Casilla         | Marcada = publicado.                                   |

### Imágenes

Las URLs de archivos de Notion caducan en una hora, así que en cada build se
descargan, se redimensionan (logos a 400 px, fotos a 1600 px) y se convierten
a WebP en `public/uploads/`. El nombre de cada archivo se basa en la ruta del
archivo en Notion, de modo que no cambia entre sincronizaciones.

## Publicación (Cloudflare Pages)

Configuración del proyecto en Cloudflare Pages:

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Variables:** `NOTION_API_KEY`, `NOTION_DATABASE_ID`, `SITE_URL`

### Reconstrucción automática

El sitio es estático: los cambios en Notion aparecen después del siguiente build.

1. En Cloudflare Pages: *Settings → Builds → Deploy hooks* → crea un hook para
   la rama de producción y copia la URL.
2. En GitHub: *Settings → Secrets and variables → Actions* → crea el secreto
   `CLOUDFLARE_DEPLOY_HOOK` con esa URL.
3. El workflow [`Reconstruir desde Notion`](.github/workflows/rebuild-from-notion.yml)
   llama al hook cada 3 horas. Para publicar al momento, ábrelo en la pestaña
   **Actions** y pulsa **Run workflow**.
