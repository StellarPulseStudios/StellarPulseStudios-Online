# Stellar Pulse · Directorio de emprendimientos

Sitio estático con los emprendimientos participantes de Stellar Pulse.
Los datos se capturan en una base de datos de **Notion**, el sitio se genera
con **Astro** y se publica en **Cloudflare Workers** (Workers Builds, Worker
`stellarpulsestudios-web`, rama `master`).

```
Notion ──(sync en cada build)──▶ src/data/exhibitors.json + public/uploads/*.webp ──▶ Astro ──▶ Cloudflare Workers
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
| `INSTAGRAM_ACCESS_TOKEN` | Opcional. Token de la cuenta de Instagram para la sección del inicio. |

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

## Publicación (Cloudflare Workers)

Cada push a `master` dispara un build en Cloudflare (Workers Builds), que
ejecuta `npm run build` y publica la carpeta `dist/`.

Variables de **build** del Worker (*Settings → Builds → Variables*):
`NOTION_API_KEY`, `NOTION_DATABASE_ID`, `SITE_URL`
(`https://stellarpulsestudios.com`) e `INSTAGRAM_ACCESS_TOKEN` (como secreto).

### Dominio

El sitio se sirve en **https://stellarpulsestudios.com**, conectado como
*Custom Domain* del Worker (*Settings → Domains & Routes*). `www` redirige al
dominio principal. La dirección `*.workers.dev` sigue respondiendo, pero la URL
canónica y el sitemap apuntan al dominio propio.

Los builds de vista previa de otras ramas pueden fallar si esas variables solo
están disponibles para producción; eso no afecta al sitio publicado.

`public/_headers` define la caché de los archivos estáticos.

### Reconstrucción automática

El sitio es estático: los cambios en Notion aparecen después del siguiente build.

1. En Cloudflare: Worker → *Settings → Builds → Deploy hooks* → crea un hook
   para `master` y copia la URL.
2. En GitHub: *Settings → Secrets and variables → Actions* → crea el secreto
   `CLOUDFLARE_DEPLOY_HOOK` con esa URL. No la compartas.
3. El workflow [`Reconstruir desde Notion`](.github/workflows/rebuild-from-notion.yml)
   llama al hook cada 3 horas. Para publicar al momento, ábrelo en la pestaña
   **Actions** y pulsa **Run workflow**.

### Instagram

La sección «Síguenos» del inicio muestra el perfil de
[@stellarpulse_studios](https://www.instagram.com/stellarpulse_studios/) y sus
últimas 12 publicaciones. `scripts/sync-instagram.ts` las trae en cada build
con la API oficial de Instagram, guarda los datos en `src/data/instagram.json`
y descarga las fotos a `public/uploads/instagram/`. Se actualiza junto con
Notion (cada 3 horas).

Para conectarla (una sola vez, la cuenta debe ser profesional):

1. En [Meta for Developers](https://developers.facebook.com/apps/) crea una app
   de tipo *Empresa* con el caso de uso de la API de Instagram.
2. En la app: *Instagram → Configuración de la API con inicio de sesión de
   Instagram → Generar tokens de acceso* → **Agregar cuenta**, entra con
   @stellarpulse_studios y pulsa **Generar token**. Copia el token.
3. En Cloudflare: Worker → *Settings → Builds → Variables* → agrega el
   secreto `INSTAGRAM_ACCESS_TOKEN` con ese token y vuelve a publicar.

El token dura 60 días y cada build lo renueva. Si Instagram falla o falta el
token, el build no se detiene: se conservan los últimos datos y la sección se
muestra con el botón y el QR. Si en el log del build aparece «Instagram
devolvió un token nuevo», genera otro token en Meta y reemplázalo en Cloudflare.

## Archivos de diseño

`design/` guarda los originales en alta resolución (no se publican). Las
versiones optimizadas que usa el sitio están en `public/brand/`.
