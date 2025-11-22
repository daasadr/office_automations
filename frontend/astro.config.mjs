import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import path from 'path';
import { fileURLToPath } from 'url';

import sentry from '@sentry/astro';
import AstroPWA from '@vite-pwa/astro';

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
  integrations: [
    react(), 
    tailwind({ applyBaseStyles: false }), 
    sentry({
    project: "odpady-astro-app",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      environment: import.meta.env.NODE_ENV || 'development',
    }),
    AstroPWA({
      mode: 'production',
      base: basePath || '/',
      scope: basePath || '/',
      includeAssets: ['favicon.svg'],
      registerType: 'autoUpdate',
      manifest: {
        name: 'Odpady Astro App',
        short_name: 'Odpady',
        description: 'Aplikace pro zpracování souborů',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'minimal-ui',
        orientation: 'any',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        navigateFallback: '/',
        globPatterns: ['**/*.{css,js,html,svg,png,ico,txt}']
      },
      devOptions: {
        enabled: false,
        navigateFallbackAllowlist: [/^\//]
      },
      experimental: {
        directoryAndTrailingSlashHandler: true
      }
    })
  ],
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