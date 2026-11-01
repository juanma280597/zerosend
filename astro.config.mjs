import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: process.env.PUBLIC_SITE_URL || 'https://zerosend.example',
  trailingSlash: 'never',
  compressHTML: true,
  build: { inlineStylesheets: 'never' },
});
