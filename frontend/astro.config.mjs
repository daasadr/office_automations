import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [react(), tailwind({ applyBaseStyles: false })],
  server: {
    port: 4321,
    host: true
  },
  vite: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/components': path.resolve(__dirname, './src/components'),
        '@/lib': path.resolve(__dirname, './src/lib'),
        '@/utils': path.resolve(__dirname, './src/utils'),
        '@/pages': path.resolve(__dirname, './src/pages'),
        '@/layouts': path.resolve(__dirname, './src/layouts'),
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          // Add any SCSS options if needed later
        }
      }
    }
  }
});
