// @ts-check

import node from '@astrojs/node';

import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: cloudflare(),
});