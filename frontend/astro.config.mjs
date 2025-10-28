import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import path from 'path';
import { fileURLToPath } from 'url';

import sentry from '@sentry/astro';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get base path from environment variable
const basePath = process.env.PUBLIC_BASE_PATH || '';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  // Set the base path for the application
  base: basePath,
  integrations: [react(), tailwind({ applyBaseStyles: false }), sentry({
    project: "odpady-astro-app",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      environment: import.meta.env.NODE_ENV || 'development',
  })],
  server: {
    port: 4321,
    host: true
  },
  vite: {
    server: {
      allowedHosts: [
        'dejtoai.cz',
        'dev-dejtoai.local',
        '.dev-dejtoai.local', // Allow all subdomains
        'localhost',
        '127.0.0.1'
      ],
      hmr: {
        clientPort: 443,
        protocol: 'wss'
      }
    },
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