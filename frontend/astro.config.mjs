import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

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
    css: {
      preprocessorOptions: {
        scss: {
          // Add any SCSS options if needed later
        }
      }
    }
  }
});
