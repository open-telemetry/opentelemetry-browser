import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves at /opentelemetry-browser/
  base: process.env.CI ? '/opentelemetry-browser/' : '/',
})
