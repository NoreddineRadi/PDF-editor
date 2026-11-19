// Rendu SEO : pages, balises, JSON-LD, sitemap, robots et plugin (simulé sous Node, sans Vite)
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { injectSeo, renderSitemap, renderRobots, normalizeSiteUrl, normalizeHttpsUrl, pageTitle, esc } from "../build/seoRender.js";
import seoPlugin, { resolveSeoConfig } from "../build/seoPlugin.js";
import { PAGES, LOCALES, pagePath } from "../src/seo/routes.js";
import fr from "../src/seo/content/fr.js";
import en from "../src/seo/content/en.js";
import nl from "../src/seo/content/nl.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };
const CONTENT = { fr, en, nl };
const APP = `<!DOCTYPE html>\n<html lang="fr">\n  <head>\n    <meta charset="UTF-8" />\n    <title>Éditeur PDF</title>\n    <script type="module" crossorigin src="/assets/index-abc.js"></script>\n  </head>\n  <body>\n    <div id="app"></div>\n  </body>\n</html>`;
const SITE = "https://pdf.example.org";
const cfg = { siteUrl: SITE, paypalUrl: "", googleSiteVerification: "", bingSiteVerification: "" };
const page = (locale, id, config = cfg) => injectSeo(APP, { content: CONTENT[locale], id, locale, siteUrl: config.siteUrl, config });
const ldBlocks = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1].replace(/\\u003c/g, "<")));

test("page SEO : lang, title, description, canonical absolu, hreflang x4", () => {
  const h = page("en", "sign");
  assert.ok(h.includes('<html lang="en">'));
  assert.match(h, /<title>Sign a PDF for Free Online, No Sign-up \| PDF Studio<\/title>/);
  assert.ok(h.includes(`<link rel="canonical" href="${SITE}/en/sign-pdf/" />`));
  for (const l of LOCALES) assert.ok(h.includes(`hreflang="${l}" href="${SITE}${pagePath(l, "sign")}"`), l);
  assert.ok(h.includes(`hreflang="x-default" href="${SITE}/signer-pdf/"`));
  assert.ok(h.includes('<meta name="description" content="Sign a PDF for free'));
  assert.ok(h.includes('<script type="module" crossorigin src="/assets/index-abc.js">'), "assets de l'app conservés");
  assert.equal((h.match(/<title>/g) || []).length, 1);
  assert.equal((h.match(/<div id="app"><\/div>/g) || []).length, 1);
});

test("page SEO : un seul h1, contenu pré-rendu, liens internes valides", () => {
  const known = new Set(LOCALES.flatMap((l) => PAGES.map((p) => pagePath(l, p.id))));
  for (const l of LOCALES) for (const p of PAGES) {
    const h = page(l, p.id);
    assert.equal((h.match(/<h1>/g) || []).length, 1, `${l}/${p.id}`);
    assert.ok(h.includes(esc(CONTENT[l].pages[p.id].h1)));
    for (const m of h.matchAll(/<a [^>]*href="(\/[^"#]*)"/g)) assert.ok(known.has(m[1]) || /\.(svg|png|webmanifest)$/.test(m[1]), `${l}/${p.id} lien ${m[1]}`);
    assert.ok(!/undefined|\[object/.test(h), `${l}/${p.id}`);
  }
});

test("JSON-LD : WebApplication gratuite, FAQPage, fil d'Ariane (hors accueil)", () => {
  const home = ldBlocks(page("fr", "home"));
  assert.deepEqual(home.map((b) => b["@type"]), ["WebApplication", "FAQPage"]);
  assert.equal(home[0].offers.price, "0");
  assert.equal(home[0].isAccessibleForFree, true);
  const sign = ldBlocks(page("nl", "sign"));
  assert.deepEqual(sign.map((b) => b["@type"]), ["WebApplication", "FAQPage", "BreadcrumbList"]);
  assert.equal(sign[1].mainEntity.length, CONTENT.nl.pages.sign.faq.length);
  assert.equal(sign[2].itemListElement[1].item, `${SITE}/nl/pdf-ondertekenen/`);
});

test("sécurité : le contenu est échappé (HTML et JSON-LD)", () => {
  const evil = structuredClone(CONTENT.fr);
  evil.pages.home.faq = [['Q </script><script>alert(1)</script>', 'A "<b>x</b>" & co']];
  evil.pages.home.h1 = '<img src=x onerror=alert(1)>';
  const h = injectSeo(APP, { content: evil, id: "home", locale: "fr", siteUrl: SITE, config: cfg });
  assert.ok(!h.includes("<img src=x"));
  assert.ok(!h.includes("<script>alert(1)"));
  assert.equal(h.match(/<script/g).length, 1 + 2 /* module + 2 JSON-LD */);
});

test("vérifications Search Console / Bing et don : seulement si renseignés", () => {
  const none = page("fr", "home");
  assert.ok(!none.includes("google-site-verification") && !none.includes("msvalidate") && !none.includes("paypal"));
  const on = page("fr", "home", { ...cfg, googleSiteVerification: "G-abc", bingSiteVerification: "B-123", paypalUrl: "https://paypal.me/x" });
  assert.ok(on.includes('<meta name="google-site-verification" content="G-abc" />'));
  assert.ok(on.includes('<meta name="msvalidate.01" content="B-123" />'));
  assert.ok(on.includes('href="https://paypal.me/x" target="_blank" rel="noopener noreferrer nofollow"'));
});

test("sans siteUrl : chemins relatifs (pas de 'undefined')", () => {
  const h = page("fr", "merge", { ...cfg, siteUrl: "" });
  assert.ok(h.includes('<link rel="canonical" href="/fusionner-pdf/" />'));
});

test("titres : <= 70 caractères, uniques par langue", () => {
  for (const l of LOCALES) {
    const t = PAGES.map((p) => pageTitle(CONTENT[l], p.id));
    t.forEach((x) => assert.ok(x.length <= 70, x));
    assert.equal(new Set(t).size, t.length);
  }
});

test("sitemap : 36 URL, hreflang réciproques, bien formé", () => {
  const xml = renderSitemap(SITE, "2026-11-19");
  assert.equal((xml.match(/<url>/g) || []).length, LOCALES.length * PAGES.length);
  assert.equal((xml.match(/<\/url>/g) || []).length, LOCALES.length * PAGES.length);
  assert.equal((xml.match(/hreflang="x-default"/g) || []).length, LOCALES.length * PAGES.length);
  assert.ok(xml.includes(`<loc>${SITE}/</loc>`) && xml.includes(`<loc>${SITE}/en/sign-pdf/</loc>`));
  assert.ok(xml.startsWith("<?xml") && xml.trim().endsWith("</urlset>"));
});

test("robots.txt et normalisation des URL", () => {
  assert.ok(renderRobots(SITE).includes(`Sitemap: ${SITE}/sitemap.xml`));
  assert.ok(!renderRobots("").includes("Sitemap"));
  assert.equal(normalizeSiteUrl(" https://a.org/ "), "https://a.org");
  assert.equal(normalizeSiteUrl("ftp://a.org"), "");
  assert.equal(normalizeSiteUrl("n'importe quoi"), "");
  assert.equal(normalizeHttpsUrl("http://paypal.me/x"), "");
  assert.equal(normalizeHttpsUrl("javascript:alert(1)"), "");
  assert.equal(normalizeHttpsUrl("https://paypal.me/x"), "https://paypal.me/x");
});

test("config : la variable d'environnement prime sur site.config.js", () => {
  const c = resolveSeoConfig({ siteUrl: "https://file.org", paypalUrl: "https://paypal.me/f" }, { VITE_SITE_URL: "https://env.org/" });
  assert.equal(c.siteUrl, "https://env.org");
  assert.equal(c.paypalUrl, "https://paypal.me/f");
});

test("plugin : écrit toutes les pages, robots.txt et sitemap.xml dans dist/", () => {
  const dir = mkdtempSync(join(tmpdir(), "seo-"));
  const plugin = seoPlugin({ ...cfg });
  plugin.configResolved({ command: "build" });
  const home = plugin.transformIndexHtml.handler(APP, {});
  assert.ok(home.includes('<html lang="fr">') && home.includes(`href="${SITE}/"`));
  plugin.writeBundle({ dir });
  for (const l of LOCALES) for (const p of PAGES) {
    if (l === "fr" && p.id === "home") continue;
    const f = join(dir, pagePath(l, p.id), "index.html");
    assert.ok(existsSync(f), f);
    assert.ok(readFileSync(f, "utf8").includes(`<html lang="${l}">`));
  }
  assert.ok(existsSync(join(dir, "robots.txt")) && existsSync(join(dir, "sitemap.xml")));
  assert.ok(readdirSync(dir).includes("en") && readdirSync(dir).includes("nl"));
});

test("plugin en dev : la route demandée détermine langue et page", () => {
  const plugin = seoPlugin({ ...cfg });
  plugin.configResolved({ command: "serve" });
  const h = plugin.transformIndexHtml.handler(APP, { originalUrl: "/nl/pdf-samenvoegen/" });
  assert.ok(h.includes('<html lang="nl">') && h.includes("<h1>Pdf-bestanden gratis samenvoegen</h1>"));
});

console.log(`\n${passed} tests OK`);
