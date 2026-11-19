// Contenu SEO : complétude et longueurs raisonnables pour les moteurs de recherche
import assert from "node:assert/strict";
import fr from "../src/seo/content/fr.js";
import en from "../src/seo/content/en.js";
import nl from "../src/seo/content/nl.js";
import { PAGES } from "../src/seo/routes.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };
const C = { fr, en, nl };

test("contenu : toutes les pages existent dans les 3 langues, avec les mêmes champs", () => {
  for (const [loc, c] of Object.entries(C)) {
    assert.deepEqual(Object.keys(c.ui).sort(), Object.keys(fr.ui).sort(), loc + " ui");
    for (const p of PAGES) {
      const page = c.pages[p.id];
      assert.ok(page, `${loc}/${p.id}`);
      for (const f of ["navLabel", "title", "description", "h1", "intro"]) assert.ok(String(page[f]).trim(), `${loc}/${p.id}.${f}`);
      assert.ok(page.points.length >= 4 || p.id === "privacy", `${loc}/${p.id} points`);
      assert.ok(page.faq.length >= 2, `${loc}/${p.id} faq`);
      assert.equal(page.steps.length, fr.pages[p.id].steps.length, `${loc}/${p.id} steps`);
    }
  }
});
test("contenu : titres <= 70 car., descriptions entre 70 et 160 car.", () => {
  for (const [loc, c] of Object.entries(C)) for (const p of PAGES) {
    const { title, description } = c.pages[p.id];
    assert.ok(title.length <= 70, `${loc}/${p.id} title ${title.length}`);
    assert.ok(description.length >= 70 && description.length <= 160, `${loc}/${p.id} description ${description.length}`);
  }
});
test("contenu : titres et descriptions uniques dans une langue", () => {
  for (const [loc, c] of Object.entries(C)) {
    const titles = PAGES.map((p) => c.pages[p.id].title);
    const descs = PAGES.map((p) => c.pages[p.id].description);
    assert.equal(new Set(titles).size, titles.length, loc + " titles");
    assert.equal(new Set(descs).size, descs.length, loc + " descriptions");
  }
});

console.log(`\n${passed} tests OK`);
