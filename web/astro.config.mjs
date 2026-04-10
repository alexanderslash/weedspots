import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: process.env.SITE_URL || 'https://weedspots.io',
  output: 'static',
  trailingSlash: 'always',
  outDir: './dist',
  build: { format: 'directory' },
  vite: { plugins: [tailwindcss()] },
});
