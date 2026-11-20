// QR code : structure de la matrice. Le décodage réel (OpenCV, 81 cas : versions 1 à 20, niveaux L et M,
// capacités maximales, UTF-8) a été vérifié hors dépôt ; ici on garde des garde-fous rapides.
import assert from "node:assert/strict";
import { encodeQr, qrToSvg, qrCapacity } from "../src/utils/qrcode.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };

test("capacités connues (mode octets, niveau M) : v1=14, v2=26, v4=62, v10=213", () => {
  assert.equal(qrCapacity(1, "M"), 14);
  assert.equal(qrCapacity(2, "M"), 26);
  assert.equal(qrCapacity(4, "M"), 62);
  assert.equal(qrCapacity(10, "M"), 213);
  assert.equal(qrCapacity(1, "L"), 17);
});

test("taille = 4 x version + 17 ; version minimale choisie", () => {
  const a = encodeQr("https://paypal.me/pseudo");
  assert.equal(a.size, a.version * 4 + 17);
  assert.equal(a.version, 2);
  const b = encodeQr("x".repeat(62));
  assert.equal(b.version, 4);
  assert.equal(encodeQr("x".repeat(63)).version, 5);
});

test("motifs de repérage aux 3 coins, module sombre fixe, déterminisme", () => {
  const q = encodeQr("https://paypal.me/pseudo");
  const m = q.modules;
  const finder = (x0, y0) => {
    for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) {
      const edge = dx === 0 || dx === 6 || dy === 0 || dy === 6;
      const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      assert.equal(m[y0 + dy][x0 + dx], edge || core, `${x0},${y0} ${dx},${dy}`);
    }
  };
  finder(0, 0); finder(q.size - 7, 0); finder(0, q.size - 7);
  assert.equal(m[q.size - 8][8], true);
  assert.deepEqual(encodeQr("https://paypal.me/pseudo").modules, m);
  assert.notDeepEqual(encodeQr("https://paypal.me/autre").modules, m);
});

test("trop long -> erreur ; UTF-8 accepté", () => {
  assert.throws(() => encodeQr("x".repeat(2000)));
  assert.ok(encodeQr("https://paypal.me/é€✓").version >= 1);
});

test("SVG : viewBox avec zone de silence, label échappé", () => {
  const q = encodeQr("abc");
  const svg = qrToSvg(q, { label: 'a "b" <c>' });
  assert.ok(svg.startsWith("<svg") && svg.includes(`viewBox="0 0 ${q.size + 8} ${q.size + 8}"`));
  assert.ok(svg.includes('aria-label="a &quot;b&quot; &lt;c&gt;"'));
  assert.ok(!svg.includes("<script"));
});

console.log(`\n${passed} tests OK`);
