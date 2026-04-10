// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  outDir: '../dist',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
