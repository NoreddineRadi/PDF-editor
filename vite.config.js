import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
    esbuildOptions: { target: 'esnext' },
  },
  build: {
    // pdfjs-dist (v4+) utilise le top-level await : 'es2020' fait échouer le build
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('pdf-lib')) return 'pdf-lib'
            if (id.includes('pdfjs-dist') || id.includes('pdf.worker')) return 'pdfjs'
            if (id.includes('primevue') || id.includes('primeicons')) return 'primevue'
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) return 'vue-vendor'
            return 'vendor'
          }
        },
      },
    },
  },
})
