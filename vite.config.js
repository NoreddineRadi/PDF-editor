import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import seoPlugin, { resolveSeoConfig } from './build/seoPlugin.js';
import siteConfig from './site.config.js';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
);

// Hash du commit : variables fournies automatiquement par la CI (GitHub Actions / GitLab CI),
// sinon git en local, sinon "dev". Aucune modification du workflow de déploiement n'est nécessaire.
function resolveCommit() {
  const fromCi = process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return (
      execSync('git rev-parse --short HEAD', {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim() || 'dev'
    );
  } catch {
    return 'dev';
  }
}

export default defineConfig(({ mode }) => {
  // Variables d'environnement (.env ou CI) : elles priment sur site.config.js
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  const seo = resolveSeoConfig(siteConfig, env);
  return {
    base: env.VITE_BASE_URL || '',
    plugins: [vue(), seoPlugin(seo)],
    define: {
      __DONATE_URL__: JSON.stringify(seo.paypalUrl),
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_COMMIT__: JSON.stringify(resolveCommit()),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    },
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
              if (id.includes('pdf-lib')) return 'pdf-lib';
              if (id.includes('pdfjs-dist') || id.includes('pdf.worker'))
                return 'pdfjs';
              if (id.includes('primevue') || id.includes('primeicons'))
                return 'primevue';
              if (
                id.includes('vue') ||
                id.includes('pinia') ||
                id.includes('vue-router')
              )
                return 'vue-vendor';
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
