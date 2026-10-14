import { defineConfig } from 'astro/config';
export default defineConfig({
  output: 'static',
  outDir: process.env.SITE_BUILD_DIR || './dist',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
