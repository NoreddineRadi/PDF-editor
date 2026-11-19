/**
 * Rendu SEO des pages statiques (fonctions PURES : testables sous Node, sans Vite).
 * Chaque page = le HTML de l'application (même JS/CSS) + balises <head> propres à la page + contenu éditorial pré-rendu.
 */
import { PAGES, LOCALES, DEFAULT_LOCALE, OG_LOCALE, LOCALE_NAMES, pagePath } from '../src/seo/routes.js';

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** JSON pour <script type="application/ld+json"> : "<" échappé pour ne jamais fermer la balise. */
export const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');

export function normalizeSiteUrl(value) {
  const v = String(value || '').trim().replace(/\/+$/, '');
  if (!v) return '';
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin + u.pathname.replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
}

export function normalizeHttpsUrl(value) {
  try {
    const u = new URL(String(value || '').trim());
    return u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

export function pageTitle(content, id) {
  const { title } = content.pages[id];
  const brand = content.ui.siteName;
  if (id === 'home') return title;
  const full = `${title} | ${brand}`;
  return full.length <= 70 ? full : title;
}

const SEO_CSS = `
.seo{background:#fff;color:#0f172a;font:16px/1.65 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;content-visibility:auto;contain-intrinsic-size:auto 900px}
.seo-wrap{max-width:860px;margin:0 auto;padding:48px 20px 40px}
.seo a{color:#1d4ed8}
.seo h1{font-size:2rem;line-height:1.2;margin:0 0 .6rem}
.seo h2{font-size:1.35rem;margin:2.2rem 0 .7rem}
.seo h3{font-size:1.05rem;margin:1.3rem 0 .3rem}
.seo p{margin:.5rem 0}
.seo ul,.seo ol{padding-left:1.3rem;margin:.5rem 0}
.seo li{margin:.35rem 0}
.seo-crumbs{font-size:.85rem;color:#475569;margin-bottom:.8rem}
.seo-badges{display:flex;flex-wrap:wrap;gap:.5rem;list-style:none;padding:0;margin:.8rem 0}
.seo-badges li{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;border-radius:999px;padding:.15rem .75rem;font-size:.85rem;margin:0}
.seo-cta{display:inline-block;background:#2563eb;color:#fff!important;text-decoration:none;font-weight:600;border-radius:8px;padding:.6rem 1.2rem;margin:.8rem 0}
.seo-tools{columns:2;column-gap:2rem;list-style:none;padding:0}
.seo-lang a{margin-right:.9rem}
.seo-foot{margin-top:2.5rem;padding-top:1.2rem;border-top:1px solid #e2e8f0;color:#475569;font-size:.9rem}
@media (max-width:600px){.seo-tools{columns:1}.seo h1{font-size:1.6rem}}
`.replace(/\n/g, '');

function metaFor({ content, id, locale, siteUrl, config }) {
  const page = content.pages[id];
  const abs = (path) => (siteUrl ? siteUrl + path : path);
  const url = abs(pagePath(locale, id));
  const title = pageTitle(content, id);
  const image = abs('/og-image.png');

  const alternates = LOCALES.map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${esc(abs(pagePath(l, id)))}" />`,
  );
  alternates.push(`<link rel="alternate" hreflang="x-default" href="${esc(abs(pagePath(DEFAULT_LOCALE, id)))}" />`);

  const tags = [
    `<meta name="description" content="${esc(page.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    ...alternates,
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />`,
    `<meta name="theme-color" content="#0f172a" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(content.ui.siteName)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:locale" content="${OG_LOCALE[locale]}" />`,
    ...LOCALES.filter((l) => l !== locale).map((l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}" />`),
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(content.ui.appName)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`,
    `<link rel="manifest" href="/manifest.webmanifest" />`,
  ];
  if (config.googleSiteVerification) tags.push(`<meta name="google-site-verification" content="${esc(config.googleSiteVerification)}" />`);
  if (config.bingSiteVerification) tags.push(`<meta name="msvalidate.01" content="${esc(config.bingSiteVerification)}" />`);

  // Données structurées : application web gratuite + FAQ + fil d'Ariane
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: content.ui.appName,
      url,
      description: page.description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any (web browser)',
      browserRequirements: 'Requires JavaScript',
      inLanguage: locale,
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      featureList: page.points,
    },
  ];
  if (page.faq.length) {
    ld.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    });
  }
  if (id !== 'home') {
    ld.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: content.ui.breadcrumbHome, item: abs(pagePath(locale, 'home')) },
        { '@type': 'ListItem', position: 2, name: page.navLabel, item: url },
      ],
    });
  }
  for (const obj of ld) tags.push(`<script type="application/ld+json">${jsonLd(obj)}</script>`);
  tags.push(`<style id="seo-css">${SEO_CSS}</style>`);
  return { title, tags: tags.join('\n    ') };
}

function bodyFor({ content, id, locale, config }) {
  const page = content.pages[id];
  const ui = content.ui;
  const li = (items) => items.map((x) => `<li>${esc(x)}</li>`).join('');

  const crumbs =
    id === 'home'
      ? ''
      : `<nav class="seo-crumbs" aria-label="breadcrumb"><a href="${pagePath(locale, 'home')}">${esc(ui.breadcrumbHome)}</a> › ${esc(page.navLabel)}</nav>`;

  const steps = page.steps.length ? `<h2>${esc(ui.howTo)}</h2><ol>${li(page.steps)}</ol>` : '';
  const pointsTitle = id === 'privacy' ? page.navLabel : ui.why;
  const faq = page.faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('');
  const tools = PAGES.filter((p) => p.id !== id && p.id !== 'privacy' && p.id !== 'home')
    .map((p) => `<li><a href="${pagePath(locale, p.id)}">${esc(content.pages[p.id].navLabel)}</a></li>`)
    .join('');
  const langs = LOCALES.map((l) => `<a href="${pagePath(l, id)}" hreflang="${l}" lang="${l}"${l === locale ? ' aria-current="true"' : ''}>${esc(LOCALE_NAMES[l])}</a>`).join('');
  const donate = config.paypalUrl
    ? `<p><a href="${esc(config.paypalUrl)}" target="_blank" rel="noopener noreferrer nofollow">${esc(ui.donate)}</a> · ${esc(ui.donateNote)}</p>`
    : '';

  return `<noscript><p style="padding:16px;font:16px sans-serif">${esc(ui.noscript)}</p></noscript>
<main class="seo" id="seo-content">
<div class="seo-wrap">
${crumbs}
<h1>${esc(page.h1)}</h1>
<ul class="seo-badges">${li(ui.badges)}</ul>
<p>${esc(page.intro)}</p>
<p><a class="seo-cta" href="#app">${esc(ui.openEditor)}</a></p>
${steps}
<h2>${esc(pointsTitle)}</h2><ul>${li(page.points)}</ul>
<h2>${esc(ui.faq)}</h2>${faq}
<h2>${esc(ui.tools)}</h2><ul class="seo-tools"><li><a href="${pagePath(locale, 'home')}">${esc(content.pages.home.navLabel)}</a></li>${tools}</ul>
<footer class="seo-foot"><p class="seo-lang"><strong>${esc(ui.language)} :</strong> ${langs}</p><p>${esc(ui.footer)}</p><p><a href="${pagePath(locale, 'privacy')}">${esc(ui.privacyLink)}</a></p>${donate}</footer>
</div>
</main>`;
}

/**
 * Transforme le HTML de l'application (index.html construit) en page SEO pour (locale, id).
 * @param {string} html  HTML de l'application
 * @param {{content:object, id:string, locale:string, siteUrl:string, config:object}} opts
 */
export function injectSeo(html, opts) {
  const { title, tags } = metaFor(opts);
  const body = bodyFor(opts);
  let out = html;
  out = /<html[^>]*>/i.test(out)
    ? out.replace(/<html[^>]*>/i, `<html lang="${opts.locale}">`)
    : out;
  out = /<title>[\s\S]*?<\/title>/i.test(out)
    ? out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
    : out.replace('</head>', `<title>${esc(title)}</title>\n</head>`);
  out = out.replace('</head>', `    ${tags}\n  </head>`);
  if (!/<div id="app"><\/div>/.test(out)) throw new Error('seoRender : <div id="app"></div> introuvable dans le HTML');
  out = out.replace('<div id="app"></div>', `<div id="app"></div>\n${body}`);
  return out;
}

export function renderSitemap(siteUrl, lastmod) {
  const abs = (p) => siteUrl + p;
  const entries = [];
  for (const loc of LOCALES) {
    for (const p of PAGES) {
      const links = LOCALES.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${esc(abs(pagePath(l, p.id)))}"/>`);
      links.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(abs(pagePath(DEFAULT_LOCALE, p.id)))}"/>`);
      entries.push(`  <url>\n    <loc>${esc(abs(pagePath(loc, p.id)))}</loc>\n    <lastmod>${lastmod}</lastmod>\n${links.join('\n')}\n  </url>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
}

export function renderRobots(siteUrl) {
  const lines = ['User-agent: *', 'Allow: /', ''];
  if (siteUrl) lines.push(`Sitemap: ${siteUrl}/sitemap.xml`, '');
  return lines.join('\n');
}
