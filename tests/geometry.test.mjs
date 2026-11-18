// Tests sans dépendance : node tests/geometry.test.mjs  (ou : yarn test)
import assert from "node:assert/strict";
import {
  localToView, viewToLocal, viewToUser, hitTest, buildStrokeAnnotation, pointsToPath, normalizeRightAngle,
} from "../src/utils/annotationGeometry.js";
import { buildPageOps } from "../src/services/annotationOps.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

const W = 600, H = 800;
const box = { x: 10, y: 20, width: 30, height: 10 }; // 180x80 pt, coin (60,160), centre (150,200)

test("localToView sans rotation", () => {
  const p = localToView({ ...box, rotation: 0 }, 0, 0, W, H);
  near(p.x, 60); near(p.y, 160);
});

test("rotation 90° : le coin haut-gauche passe en haut-droite (sens horaire)", () => {
  const p = localToView({ ...box, rotation: 90 }, 0, 0, W, H);
  near(p.x, 190); near(p.y, 110);
});

test("viewToLocal est l'inverse de localToView", () => {
  for (const rot of [0, 33, 90, 135, 217, 270]) {
    const a = { ...box, rotation: rot };
    const v = localToView(a, 40, 17, W, H);
    const l = viewToLocal(a, v.x, v.y, W, H);
    near(l.x, 40); near(l.y, 17);
  }
});

test("viewToUser : coins pour chaque rotation de page", () => {
  const eq = (p, x, y) => { near(p.x, x); near(p.y, y); };
  eq(viewToUser(0, 0, W, H, 0), 0, H);
  eq(viewToUser(1, 1, W, H, 0), W, 0);
  eq(viewToUser(0, 0, W, H, 90), 0, 0);
  eq(viewToUser(1, 0, W, H, 90), 0, H);
  eq(viewToUser(0, 0, W, H, 180), W, 0);
  eq(viewToUser(0, 0, W, H, 270), W, H);
});

test("texte : position et largeur à rotation 0", () => {
  const [op] = buildPageOps([{ type: "text", ...box, height: 3, rotation: 0, text: "Hi", fontSize: 16, color: "#ff0000" }], { W, H, R: 0 });
  near(op.x, 66); near(op.y, 620); near(op.rotateDeg, 0); near(op.maxWidth, 168); near(op.lineHeight, 20.8);
});

test("texte sur une page tournée de 90°", () => {
  const [op] = buildPageOps([{ type: "text", x: 10, y: 20, width: 30, height: 3, rotation: 0, text: "Hi", fontSize: 16 }], { W, H, R: 90 });
  near(op.x, 140); near(op.y, 86); near(op.rotateDeg, 90);
});

test("rotation d'un élément : l'angle pdf-lib vaut R - rotation", () => {
  const [op] = buildPageOps([{ type: "text", ...box, rotation: 30, text: "x" }], { W, H, R: 90 });
  near(op.rotateDeg, 60);
});

test("masque tourné de 180° : même zone, coin d'ancrage opposé", () => {
  const [op] = buildPageOps([{ type: "mask", x: 0, y: 0, width: 50, height: 50, rotation: 180, color: "#fff" }], { W, H, R: 0 });
  near(op.x, 300); near(op.y, 800); near(op.width, 300); near(op.height, 400); near(op.rotateDeg, -180);
});

test("origine du CropBox ajoutée", () => {
  const [op] = buildPageOps([{ type: "mask", x: 0, y: 0, width: 10, height: 10, rotation: 0, color: "#fff" }], { W, H, R: 0, origin: { x: 20, y: 30 } });
  near(op.x, 20); near(op.y, 30 + H - 80);
});

test("trait : aller-retour px -> boîte relative -> export", () => {
  const pts = [{ x: 100, y: 100 }, { x: 300, y: 200 }];
  const a = { id: "a", ...buildStrokeAnnotation(pts, { pageW: W, pageH: H, zoom: 1, strokePt: 4, type: "drawing", color: "#000" }) };
  const back = a.points.map((p) => localToView(a, p.x * ((a.width / 100) * W), p.y * ((a.height / 100) * H), W, H));
  near(back[0].x, 100); near(back[0].y, 100); near(back[1].x, 300); near(back[1].y, 200);
  const ops = buildPageOps([a], { W, H, R: 0 });
  assert.equal(ops.length, 1);
  near(ops[0].start.x, 100); near(ops[0].start.y, 700); near(ops[0].end.x, 300); near(ops[0].end.y, 600);
});

test("un trait pivoté de 90° est exporté pivoté", () => {
  const a = { ...buildStrokeAnnotation([{ x: 100, y: 400 }, { x: 300, y: 400 }], { pageW: W, pageH: H, zoom: 1, strokePt: 4, type: "highlight", color: "#ff0" }), rotation: 90 };
  const [op] = buildPageOps([a], { W, H, R: 0 });
  near(op.start.x, 200, 1e-6); near(op.end.x, 200, 1e-6); // le segment horizontal devient vertical
  assert.ok(Math.abs(op.start.y - op.end.y) > 150);
  near(op.opacity, 0.35);
});

test("image : ajustement contain dans la boîte", () => {
  const sizes = new Map([["d", { width: 300, height: 100 }]]);
  const [op] = buildPageOps([{ type: "signature", dataUrl: "d", x: 0, y: 0, width: 25, height: 10, rotation: 0 }], { W, H, R: 0 }, sizes);
  near(op.width, 150); near(op.height, 50);
});

test("hitTest : boîte pivotée", () => {
  const m = { type: "mask", x: 40, y: 30, width: 40, height: 5, rotation: 90 }; // 240x40, centre (360,260) -> barre verticale
  assert.equal(hitTest(m, 360, 160, W, H), true);   // au-dessus du centre : dans la boîte pivotée
  assert.equal(hitTest(m, 260, 260, W, H), false);  // dans la boîte NON pivotée, mais hors de la boîte pivotée
  assert.equal(hitTest({ ...m, rotation: 0 }, 260, 260, W, H), true);
});

test("hitTest : trait", () => {
  const a = { id: "a", ...buildStrokeAnnotation([{ x: 100, y: 100 }, { x: 300, y: 100 }], { pageW: W, pageH: H, zoom: 1, strokePt: 4, type: "drawing", color: "#000" }) };
  assert.equal(hitTest(a, 200, 103, W, H), true);
  assert.equal(hitTest(a, 200, 160, W, H), false);
});

test("pointsToPath", () => {
  assert.equal(pointsToPath([]), "");
  assert.ok(pointsToPath([{ x: 0, y: 0 }]).startsWith("M 0 0 L"));
  assert.ok(pointsToPath([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }]).includes("Q"));
});

test("normalizeRightAngle", () => {
  assert.equal(normalizeRightAngle(-90), 270);
  assert.equal(normalizeRightAngle(450), 90);
});

console.log(`\n${passed} tests OK`);
