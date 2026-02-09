import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
      strategy: ['cookie', 'baseLocale']
    }),
    tailwindcss(),
    sveltekit(),
    svelteTesting()
  ],
  test: {
    include: ['src/**/*.test.js'],
    environment: 'jsdom',
    globals: true
  }
});
