import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';

import { periodSpellingPlugin } from './src/lib/period-spelling-plugin.mjs';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  site: process.env.PUBLIC_SITE_URL,
  markdown: {
    processor: satteri({
      hastPlugins: [periodSpellingPlugin]
    })
  }
});
