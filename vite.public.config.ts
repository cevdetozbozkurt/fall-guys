import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';

// Static distribution for GitHub Pages and Vercel. The Sites entry stays intact.
export default defineConfig({
  root: fileURLToPath(new URL('./web', import.meta.url)),
  base: './',
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: {
    outDir: fileURLToPath(new URL('./web-dist', import.meta.url)),
    emptyOutDir: true,
  },
});
