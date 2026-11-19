// Tests sans dépendance : node tests/geometry.test.mjs  (ou : yarn test)
import assert from "node:assert/strict";
import {
  localToView, viewToLocal, viewToUser, hitTest, placeToolbar, buildStrokeAnnotation, pointsToPath, normalizeRightAngle,
} from "../src/utils/annotationGeometry.js";
import { buildPageOps } from "../src/services/annotationOps.js";
import { fitImageBox } from "../src/utils/imageHelpers.js";
import { getPrimitives, flattenSegs, segsToSvgPath } from "../src/utils/shapeDefs.js";
import { reorderList, offsetCopy, nudgePosition } from "../src/utils/annotationOrder.js";
import { parsePageRange } from "../src/utils/pageRange.js";
import { describeBuild } from "../src/utils/appInfo.js";

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


test("image pivotée de 90° : coin d'ancrage et angle pdf-lib", () => {
  const sizes = new Map([["d", { width: 200, height: 100 }]]);
  const [op] = buildPageOps([{ type: "image", dataUrl: "d", x: 10, y: 20, width: 30, height: 15, rotation: 90 }], { W, H, R: 0 }, sizes);
  near(op.width, 180); near(op.height, 90);
  near(op.x, 105); near(op.y, 670); near(op.rotateDeg, -90);
});

test("image sur page tournée de 90° + rotation de l'image", () => {
  const sizes = new Map([["d", { width: 100, height: 100 }]]);
  const [op] = buildPageOps([{ type: "image", dataUrl: "d", x: 0, y: 0, width: 10, height: 10, rotation: 0 }], { W, H, R: 90 }, sizes);
  near(op.rotateDeg, 90);
  near(op.width, 60); near(op.height, 60); // boîte 80 x 60 (10 % de la vue 800 x 600) : image carrée ajustée en "contain"
});

test("fitImageBox : tient dans 40 % de la page, proportions respectées, centrée", () => {
  const b = fitImageBox(1000, 500, 800, 1130);
  near(b.width, 40); near(b.height, (160 / 1130) * 100);
  near(b.x, 30); near(b.y, (100 - b.height) / 2);
  const tall = fitImageBox(500, 2000, 800, 1000); // limitée par la hauteur
  near(tall.height, 40); near(tall.width, (100 / 800) * 100);
  near(tall.x, (100 - tall.width) / 2);
});

test("describeBuild", () => {
  assert.equal(describeBuild({ version: "1.2.3", commit: "abc1234", buildDate: "" }), "Version 1.2.3 · commit abc1234");
  assert.ok(describeBuild({ version: "1", commit: "x", buildDate: "2026-11-18T09:24:00Z" }).includes("build du"));
});


test("barre flottante : du côté opposé à la poignée de rotation", () => {
  const mid = { cy: 500, w: 200, h: 80, pageHeight: 1000 };
  assert.equal(placeToolbar({ ...mid, rot: 0 }).side, "below");   // poignée en haut -> barre en bas
  assert.equal(placeToolbar({ ...mid, rot: 180 }).side, "above"); // poignée en bas -> barre en haut
});

test("barre flottante : ne recouvre jamais la poignée, pour toutes les rotations et positions", () => {
  const TB = 34, TIP = 7; // hauteur de la barre ; demi-hauteur de la poignée (14 px)
  for (const cy of [20, 90, 500, 910, 980]) {
    for (const rot of [0, 15, 45, 90, 135, 180, 225, 270, 315, 345]) {
      for (const [w, h] of [[200, 80], [60, 60], [40, 300]]) {
        const { top } = placeToolbar({ cy, w, h, rot, pageHeight: 1000 });
        const tipY = -Math.cos((rot * Math.PI) / 180) * (h / 2 + 37); // position verticale de la poignée
        const lo = top, hi = top + TB;                                 // intervalle vertical de la barre
        assert.ok(hi <= tipY - TIP || lo >= tipY + TIP, `chevauchement cy=${cy} rot=${rot} ${w}x${h}`);
      }
    }
  }
});

test("barre flottante : bascule de côté quand la page n'a pas la place", () => {
  const nearBottom = placeToolbar({ cy: 960, w: 200, h: 80, rot: 0, pageHeight: 1000 });
  assert.equal(nearBottom.side, "above");
  assert.ok(nearBottom.top < -(40 + 37)); // au-delà de la poignée (elle est au-dessus)
});

const rectShape = { type: "shape", shape: "rect", ...box, rotation: 0, color: "#ff0000", fill: null, strokeWidth: 3 };

test("forme rect : chemin exporté (rotation 0, page 0)", () => {
  const ops = buildPageOps([rectShape], { W, H, R: 0 });
  assert.equal(ops.length, 1);
  const [op] = ops;
  assert.equal(op.kind, "path"); assert.equal(op.fill, null); assert.equal(op.stroke, "#ff0000"); assert.equal(op.strokeWidth, 3);
  assert.deepEqual(op.cmds.map((c) => c[0]), ["M", "L", "L", "L", "Z"]);
  near(op.cmds[0][1], 60); near(op.cmds[0][2], 640);
  near(op.cmds[1][1], 240); near(op.cmds[1][2], 640);
  near(op.cmds[3][1], 60); near(op.cmds[3][2], 560);
});

test("forme tournée de 90° : coin haut-gauche -> haut-droite (vue) -> espace PDF", () => {
  const [op] = buildPageOps([{ ...rectShape, rotation: 90 }], { W, H, R: 0 });
  // vue : (190,110) -> utilisateur (190, 690)
  near(op.cmds[0][1], 190); near(op.cmds[0][2], 690);
});

test("forme sur une page tournée : mêmes règles que le texte", () => {
  const [op] = buildPageOps([rectShape], { W, H, R: 90 });
  // page 90° : vue 800x600, coin de la boîte en (80,120) -> fx=.1, fy=.2 -> utilisateur (fy*W, fx*H)
  near(op.cmds[0][1], 120); near(op.cmds[0][2], 80);
});

test("cercle : 4 Béziers, remplissage seulement si défini", () => {
  const circle = { ...rectShape, shape: "ellipse", fill: "#00ff00" };
  const [op] = buildPageOps([circle], { W, H, R: 0 });
  assert.equal(op.cmds.filter((c) => c[0] === "C").length, 4);
  assert.equal(op.fill, "#00ff00");
});

test("symboles : case cochée = 2 chemins ; radio cochée = point plein ; puce pleine sans contour", () => {
  const base = { type: "symbol", x: 10, y: 10, width: 4, height: 3, rotation: 0, color: "#000000", strokeWidth: 2 };
  assert.equal(buildPageOps([{ ...base, symbol: "checkbox" }], { W, H, R: 0 }).length, 1);
  assert.equal(buildPageOps([{ ...base, symbol: "checkbox-checked" }], { W, H, R: 0 }).length, 2);
  const radio = buildPageOps([{ ...base, symbol: "radio-checked" }], { W, H, R: 0 });
  assert.equal(radio.length, 2); assert.equal(radio[1].fill, "#000000"); assert.equal(radio[1].stroke, null);
  const [bullet] = buildPageOps([{ ...base, symbol: "bullet" }], { W, H, R: 0 });
  assert.equal(bullet.fill, "#000000"); assert.equal(bullet.stroke, null);
});

test("shapeDefs : chemin SVG et aplatissement", () => {
  const [p] = getPrimitives(rectShape);
  assert.equal(segsToSvgPath(p.segs), "M 0 0 L 1 0 L 1 1 L 0 1 Z");
  const [e] = getPrimitives({ ...rectShape, shape: "ellipse" });
  const poly = flattenSegs(e.segs)[0];
  for (const [x, y] of poly.pts) near(Math.hypot(x - 0.5, y - 0.5), 0.5, 0.002);
});

test("hitTest forme : vide au centre, touché sur le bord ; plein touché au centre", () => {
  // centre de la boîte = (150, 200)
  assert.equal(hitTest(rectShape, 150, 200, W, H), false);
  assert.equal(hitTest(rectShape, 60, 200, W, H), true);
  assert.equal(hitTest({ ...rectShape, fill: "#00ff00" }, 150, 200, W, H), true);
  assert.equal(hitTest(rectShape, 400, 400, W, H), false);
});

test("z-order : reorderList", () => {
  const l = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(reorderList(l, "a", "front").map((x) => x.id), ["b", "c", "a"]);
  assert.deepEqual(reorderList(l, "c", "back").map((x) => x.id), ["c", "a", "b"]);
  assert.deepEqual(reorderList(l, "a", "forward").map((x) => x.id), ["b", "a", "c"]);
  assert.deepEqual(reorderList(l, "c", "backward").map((x) => x.id), ["a", "c", "b"]);
  assert.equal(reorderList(l, "c", "front"), null);
  assert.equal(reorderList(l, "a", "back"), null);
  assert.equal(reorderList(l, "zz", "front"), null);
});

test("duplication et déplacement clavier", () => {
  const a = { x: 10, y: 10, width: 20, height: 10 };
  const c = offsetCopy(a); near(c.x, 12); near(c.y, 12);
  const edge = offsetCopy({ x: 79, y: 89, width: 20, height: 10 }); near(edge.x, 77); near(edge.y, 87);
  const n = nudgePosition(a, 1, -1); near(n.x, 11); near(n.y, 9);
  const out = nudgePosition({ x: 90, y: 0, width: 20, height: 10 }, 50, -50); near(out.x + 10, 100); near(out.y + 5, 0);
});

test("plage de pages : formats valides", () => {
  assert.deepEqual(parsePageRange("1-3, 5", 10), [0, 1, 2, 4]);
  assert.deepEqual(parsePageRange("5,1,3-4,4", 5), [0, 2, 3, 4]);
  assert.deepEqual(parsePageRange(" 2 ; 4 - 6 ", 6), [1, 3, 4, 5]);
  assert.deepEqual(parsePageRange("7", 7), [6]);
});
test("plage de pages : saisies invalides -> null", () => {
  for (const bad of ["", "  ", "0", "1-", "-3", "3-1", "a", "1-3x", "11", "1-11", "1..3"]) {
    assert.equal(parsePageRange(bad, 10), null, JSON.stringify(bad));
  }
  assert.equal(parsePageRange("1", 0), null);
});

console.log(`\n${passed} tests OK`);
