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

  integrations: [
    sitemap({
      // /work/ is excluded until it has photographs on it: it currently shows a
      // "coming shortly" panel, has no internal links pointing at it, and would
      // be submitted to Google as thin content. Delete this filter when
      // src/assets/photos/ is populated.
      filter: (page) => !page.endsWith('/work/'),
    }),
  ],

  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },

  compressHTML: true,
});
