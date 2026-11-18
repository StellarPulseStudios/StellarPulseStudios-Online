import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Dominio público del sitio. Se usa para el sitemap, la URL canónica y las
// imágenes al compartir en redes. La variable de build SITE_URL en Cloudflare
// tiene prioridad sobre este valor.
const site = process.env.SITE_URL || 'https://stellarpulsestudios.com';

export default defineConfig({
  site,
  output: 'static',
  integrations: [sitemap()],
});
