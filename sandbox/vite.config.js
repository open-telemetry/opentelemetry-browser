import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages serves at /opentelemetry-browser/
  base: process.env.CI ? '/opentelemetry-browser/' : '/',
})
