/**
 * Géométrie des annotations (fonctions pures, sans dépendance : testables sous Node).
 *
 * Modèle commun à tous les éléments ajoutés sur une page :
 *   x, y, width, height : boîte NON pivotée, en % de la page affichée (origine en haut à gauche)
 *   rotation            : degrés, sens horaire (comme CSS rotate), autour du centre de la boîte
 *
 * "Vue" = page telle qu'affichée (rotation de page comprise), axe Y vers le bas.
 * "Utilisateur" = espace PDF (origine en bas à gauche, avant application de /Rotate).
 */

export const toRad = (deg) => (deg * Math.PI) / 180;
export const normalizeDeg = (deg) => ((deg % 360) + 360) % 360;
export const normalizeRightAngle = (deg) => normalizeDeg(Math.round(deg / 90) * 90);

export function rotateVec(x, y, deg) {
  const r = toRad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: x * c - y * s, y: x * s + y * c };
}

/** Boîte de l'annotation dans l'unité de la vue (px à l'écran, pt pour l'export). */
export function boxInUnits(ann, vw, vh) {
  const w = (ann.width / 100) * vw;
  const h = (ann.height / 100) * vh;
  const x = (ann.x / 100) * vw;
  const y = (ann.y / 100) * vh;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

/** Point local (relatif au coin haut-gauche de la boîte non pivotée) -> point de la vue. */
export function localToView(ann, lx, ly, vw, vh) {
  const b = boxInUnits(ann, vw, vh);
  const v = rotateVec(lx - b.w / 2, ly - b.h / 2, ann.rotation || 0);
  return { x: b.cx + v.x, y: b.cy + v.y };
}

/** Inverse de localToView. */
export function viewToLocal(ann, X, Y, vw, vh) {
  const b = boxInUnits(ann, vw, vh);
  const v = rotateVec(X - b.cx, Y - b.cy, -(ann.rotation || 0));
  return { x: v.x + b.w / 2, y: v.y + b.h / 2 };
}

/**
 * Fractions (0..1) depuis le coin haut-gauche de la page AFFICHÉE -> espace utilisateur PDF.
 * W et H : dimensions non pivotées de la page. R : rotation totale de la page (0/90/180/270).
 */
export function viewToUser(fx, fy, W, H, R) {
  switch (R) {
    case 90:
      return { x: fy * W, y: fx * H };
    case 180:
      return { x: (1 - fx) * W, y: fy * H };
    case 270:
      return { x: (1 - fy) * W, y: (1 - fx) * H };
    default:
      return { x: fx * W, y: (1 - fy) * H };
  }
}

export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Le point (X, Y) de la vue touche-t-il l'annotation ? (utilisé par la gomme) */
export function hitTest(ann, X, Y, vw, vh, zoom = 1) {
  const l = viewToLocal(ann, X, Y, vw, vh);
  const b = boxInUnits(ann, vw, vh);

  if (ann.type === "drawing" || ann.type === "highlight") {
    const pts = ann.points || [];
    if (!pts.length) return false;
    const tol = Math.max(((ann.strokeWidth || 3) * zoom) / 2, 2) + 5;
    if (pts.length === 1) return Math.hypot(l.x - pts[0].x * b.w, l.y - pts[0].y * b.h) <= tol;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distToSegment(l.x, l.y, pts[i].x * b.w, pts[i].y * b.h, pts[i + 1].x * b.w, pts[i + 1].y * b.h);
      if (d <= tol) return true;
    }
    return false;
  }

  const t = 2;
  return l.x >= -t && l.x <= b.w + t && l.y >= -t && l.y <= b.h + t;
}

/**
 * Où placer la barre flottante (taille, couleur…) pour qu'elle ne recouvre jamais la poignée de rotation.
 * La poignée est au-dessus de la boîte dans son repère (donc elle tourne avec elle) : la barre se met du côté
 * OPPOSÉ à la poignée ; si la page n'a pas la place, elle passe de l'autre côté mais au-delà de la poignée.
 *
 * @param {{cy:number,w:number,h:number,rot:number,pageHeight:number}} box  centre vertical, taille (px) et angle (°)
 * @returns {{side:'above'|'below', top:number}} top = décalage vertical depuis le centre de la boîte (px)
 */
export function placeToolbar({ cy, w, h, rot, pageHeight, toolbarHeight = 34, gap = 12, handleReach = 37 }) {
  const r = toRad(rot);
  const halfY = (Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r))) / 2;
  const tipY = -Math.cos(r) * (h / 2 + handleReach); // < 0 : la poignée pointe vers le haut
  const topExt = Math.max(halfY, tipY < 0 ? -tipY : 0);
  const botExt = Math.max(halfY, tipY > 0 ? tipY : 0);
  const room = toolbarHeight + gap;

  let below = tipY <= 0;
  const fitsBelow = cy + botExt + room <= pageHeight;
  const fitsAbove = cy - topExt - room >= 0;
  if (below && !fitsBelow && fitsAbove) below = false;
  else if (!below && !fitsAbove && fitsBelow) below = true;

  return below
    ? { side: 'below', top: botExt + gap }
    : { side: 'above', top: -(topExt + gap + toolbarHeight) };
}

/** Courbe lissée (Bézier quadratiques aux points médians) ; fonctionne dans n'importe quelle unité. */
export function pointsToPath(points, eps = 0.01) {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x + eps} ${points[0].y + eps}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
  }
  const a = points[points.length - 2];
  const z = points[points.length - 1];
  d += ` Q ${a.x} ${a.y}, ${z.x} ${z.y}`;
  return d;
}

/**
 * Construit une annotation "trait" (crayon / surligneur) au modèle commun.
 * pointsPx : points en px dans le calque ; strokePt : épaisseur en points PDF.
 * Les points sont stockés relativement à la boîte (0..1), ce qui permet de la redimensionner et de la pivoter.
 */
export function buildStrokeAnnotation(pointsPx, { pageW, pageH, zoom, strokePt, type, color }) {
  const pad = Math.max((strokePt * zoom) / 2, 1);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pointsPx) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const x0 = minX - pad;
  const y0 = minY - pad;
  const w = maxX - minX + 2 * pad;
  const h = maxY - minY + 2 * pad;

  return {
    type,
    x: (x0 / pageW) * 100,
    y: (y0 / pageH) * 100,
    width: (w / pageW) * 100,
    height: (h / pageH) * 100,
    rotation: 0,
    points: pointsPx.map((p) => ({ x: (p.x - x0) / w, y: (p.y - y0) / h })),
    color,
    strokeWidth: strokePt,
  };
}

export const rgbToHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");

/**
 * Couleur du fond de la page autour d'un rectangle (médiane de 8 échantillons juste à l'extérieur),
 * pour que le masque se fonde dans la page.
 */
export function sampleBackground(canvas, x, y, w, h, margin = 3) {
  try {
    const ctx = canvas.getContext("2d");
    const m = margin;
    const pts = [
      [x - m, y - m], [x + w / 2, y - m], [x + w + m, y - m],
      [x - m, y + h / 2], [x + w + m, y + h / 2],
      [x - m, y + h + m], [x + w / 2, y + h + m], [x + w + m, y + h + m],
    ];
    const rs = [];
    const gs = [];
    const bs = [];
    for (const [px, py] of pts) {
      const ix = Math.round(px);
      const iy = Math.round(py);
      if (ix < 0 || iy < 0 || ix >= canvas.width || iy >= canvas.height) continue;
      const d = ctx.getImageData(ix, iy, 1, 1).data;
      if (d[3] === 0) continue;
      rs.push(d[0]);
      gs.push(d[1]);
      bs.push(d[2]);
    }
    if (!rs.length) return "#ffffff";
    const med = (a) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)];
    return rgbToHex(med(rs), med(gs), med(bs));
  } catch {
    return "#ffffff";
  }
}
