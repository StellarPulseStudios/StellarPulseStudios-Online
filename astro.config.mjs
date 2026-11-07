import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Dominio público del sitio. Se usa para el sitemap, la URL canónica y las
// imágenes al compartir en redes. Configúralo en Cloudflare (variables de build) con la
// variable de entorno SITE_URL cuando tengan dominio propio.
const site =
  process.env.SITE_URL ||
  'https://stellarpulsestudios-web.stellarpstudios.workers.dev';

export default defineConfig({
  site,
  output: 'static',
  integrations: [sitemap()],
});
