import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
  base: './',
  server: {
    port: 5173,
    host: '0.0.0.0',
    hmr: {
      host: process.env.VITE_HMR_HOST || 'localhost',
      clientPort: Number(process.env.VITE_HMR_CLIENT_PORT || 5173),
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'react';
            if (id.includes('recharts')) return 'charts';
            if (id.includes('xlsx')) return 'excel';
            if (id.includes('i18next')) return 'i18n';
            if (id.includes('dexie') || id.includes('zustand')) return 'storage';
            if (id.includes('lucide-react')) return 'icons';
          }
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
})
