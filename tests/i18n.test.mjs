// Les trois langues doivent avoir exactement les mêmes clés, et les mêmes variables {x}
import assert from "node:assert/strict";
import fr from "../src/i18n/messages/fr.js";
import en from "../src/i18n/messages/en.js";
import nl from "../src/i18n/messages/nl.js";
import { resolveRoute, pagePath, PAGES, LOCALES } from "../src/seo/routes.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };
const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");

test("i18n : mêmes clés dans fr / en / nl", () => {
  const k = Object.keys(fr).sort();
  assert.deepEqual(Object.keys(en).sort(), k);
  assert.deepEqual(Object.keys(nl).sort(), k);
});
test("i18n : mêmes variables {x} dans chaque traduction", () => {
  for (const key of Object.keys(fr)) {
    assert.equal(vars(en[key]), vars(fr[key]), key);
    assert.equal(vars(nl[key]), vars(fr[key]), key);
    assert.ok(en[key].trim() && nl[key].trim(), key);
  }
});
test("routes : pagePath <-> resolveRoute (toutes pages, toutes langues)", () => {
  for (const loc of LOCALES) for (const p of PAGES) {
    const path = pagePath(loc, p.id);
    assert.ok(path.startsWith("/") && path.endsWith("/"), path);
    assert.deepEqual(resolveRoute(path), { locale: loc, id: p.id }, path);
  }
});
test("routes : exemples et tolérance (index.html, sans / final, inconnu)", () => {
  assert.equal(pagePath("fr", "home"), "/");
  assert.equal(pagePath("en", "home"), "/en/");
  assert.equal(pagePath("nl", "sign"), "/nl/pdf-ondertekenen/");
  assert.deepEqual(resolveRoute("/en/sign-pdf/index.html"), { locale: "en", id: "sign" });
  assert.deepEqual(resolveRoute("/signer-pdf"), { locale: "fr", id: "sign" });
  assert.deepEqual(resolveRoute("/nimporte/quoi"), { locale: "fr", id: "home" });
});
test("routes : slugs uniques par langue", () => {
  for (const loc of LOCALES) {
    const s = PAGES.map((p) => p.slugs[loc]);
    assert.equal(new Set(s).size, s.length, loc);
  }
});

console.log(`\n${passed} tests OK`);
