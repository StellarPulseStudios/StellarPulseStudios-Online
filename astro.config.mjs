import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Dominio público del sitio. Se usa para el sitemap, la URL canónica y las
// imágenes al compartir en redes. Configúralo en Cloudflare Pages con la
// variable de entorno SITE_URL cuando tengan dominio propio.
const site =
  process.env.SITE_URL ||
  'https://stellarpulsestudios-online.pages.dev';

export default defineConfig({
  site,
  output: 'static',
  integrations: [sitemap()],
});
