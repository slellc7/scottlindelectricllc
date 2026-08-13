// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://scottlindelectric.com',

  // Directory URLs: /residential/ rather than /residential.html. The old ASP.NET
  // site used .aspx and nothing has launched yet, so this is the moment to take
  // clean URLs — every old path is redirected in public/_redirects either way.
  build: { format: 'directory' },
  trailingSlash: 'always',

  integrations: [sitemap()],

  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },

  compressHTML: true,
});
