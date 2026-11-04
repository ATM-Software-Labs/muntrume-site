import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL || 'https://muntru.me',
  outDir: '_site',
  build: {
    format: 'directory'
  }
});
