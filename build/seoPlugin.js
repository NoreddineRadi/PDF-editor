/**
 * Plugin Vite : génère, pendant `vite build`, une page HTML statique par fonctionnalité et par langue
 * (dist/en/sign-pdf/index.html, …), le sitemap.xml et le robots.txt. Aucune étape supplémentaire dans la CI :
 * `yarn build` suffit, le déploiement copie simplement dist/.
 *
 * En dev (`yarn dev`), la page demandée est enrichie à la volée (utile pour tester /en/sign-pdf/).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PAGES,
  LOCALES,
  DEFAULT_LOCALE,
  pagePath,
  resolveRoute,
  normalizeBase,
} from '../src/seo/routes.js';
import {
  injectSeo,
  renderSitemap,
  renderRobots,
  normalizeSiteUrl,
  normalizeHttpsUrl,
  renderManifest,
} from './seoRender.js';
import fr from '../src/seo/content/fr.js';
import en from '../src/seo/content/en.js';
import nl from '../src/seo/content/nl.js';

const CONTENT = { fr, en, nl };

export function resolveSeoConfig(fileConfig = {}, env = {}) {
  const pick = (envKey, key) =>
    (env[envKey] ?? fileConfig[key] ?? '').toString().trim();
  const siteUrl = normalizeSiteUrl(pick('VITE_SITE_URL', 'siteUrl'));
  // Dossier de déploiement : VITE_BASE_URL > site.config.js (baseUrl) > chemin de siteUrl > racine.
  // Dériver de siteUrl évite un build "sans préfixe" si la variable d'environnement manque en CI.
  let sitePath = '';
  try {
    sitePath = siteUrl ? new URL(siteUrl).pathname : '';
  } catch {
    sitePath = '';
  }
  return {
    siteUrl,
    baseUrl: normalizeBase(pick('VITE_BASE_URL', 'baseUrl') || sitePath),
    paypalUrl: normalizeHttpsUrl(pick('VITE_PAYPAL_URL', 'paypalUrl')),
    googleSiteVerification: pick(
      'VITE_GOOGLE_SITE_VERIFICATION',
      'googleSiteVerification',
    ),
    bingSiteVerification: pick(
      'VITE_BING_SITE_VERIFICATION',
      'bingSiteVerification',
    ),
  };
}

export default function seoPlugin(config) {
  let baseHtml = null; // HTML de l'application tel que construit (avant ajout du SEO)
  let isBuild = false;
  const render = (html, locale, id) =>
    injectSeo(html, {
      content: CONTENT[locale],
      id,
      locale,
      siteUrl: config.siteUrl,
      config,
    });

  return {
    name: 'pdf-studio-seo',
    configResolved(resolved) {
      isBuild = resolved.command === 'build';
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (isBuild) baseHtml = html;
        // Dev : la route demandée ; build : accueil en français (c'est dist/index.html)
        const route = isBuild
          ? { locale: DEFAULT_LOCALE, id: 'home' }
          : resolveRoute(ctx.originalUrl || ctx.path || '/', config.baseUrl);
        return render(html, route.locale, route.id);
      },
    },
    // Dev : sert le manifest à {base}manifest.webmanifest (en build il est écrit dans dist/)
    configureServer(server) {
      const url = `${normalizeBase(config.baseUrl)}manifest.webmanifest`;
      server.middlewares.use((req, res, next) => {
        if ((req.url || '').split('?')[0] !== url) return next();
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(renderManifest(config.baseUrl));
      });
    },
    writeBundle(options) {
      if (!isBuild || !baseHtml) return;
      const outDir = options.dir || 'dist';
      let count = 0;
      for (const locale of LOCALES) {
        for (const page of PAGES) {
          if (locale === DEFAULT_LOCALE && page.id === 'home') continue; // déjà dist/index.html
          const dir = join(outDir, pagePath(locale, page.id));
          mkdirSync(dir, { recursive: true });
          writeFileSync(
            join(dir, 'index.html'),
            render(baseHtml, locale, page.id),
          );
          count++;
        }
      }
      writeFileSync(join(outDir, 'manifest.webmanifest'), renderManifest(config.baseUrl));
      writeFileSync(join(outDir, 'robots.txt'), renderRobots(config.siteUrl));
      if (config.siteUrl) {
        writeFileSync(
          join(outDir, 'sitemap.xml'),
          renderSitemap(config.siteUrl, new Date().toISOString().slice(0, 10)),
        );
      } else {
        console.warn(
          '\n[seo] ⚠ siteUrl non renseigné (site.config.js ou VITE_SITE_URL) : sitemap.xml non généré, canonical/hreflang relatifs.\n',
        );
      }
      console.log(
        `[seo] ${count + 1} pages HTML statiques générées (${LOCALES.length} langues).`,
      );
    },
  };
}
