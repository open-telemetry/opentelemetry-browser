import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves at /opentelemetry-browser/
  base: process.env.CI ? '/opentelemetry-browser/' : '/',
});
