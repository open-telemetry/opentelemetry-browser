import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      // Proxy /api to httpbin so requests are same-origin.
      // Same-origin requests expose full PerformanceResourceTiming data
      // (DNS, connect, TLS, request/response phases, sizes).
      '/api': {
        target: 'https://httpbin.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
