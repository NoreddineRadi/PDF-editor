/**
 * Convertit les annotations d'une page en opérations de dessin PDF (espace utilisateur).
 * Fonction PURE (aucune dépendance à pdf-lib) : testable sous Node, et c'est elle qui garantit que
 * ce qui est affiché correspond à ce qui est exporté (position, taille, rotation de l'élément ET de la page).
 *
 * Remarque : pdf-lib fait pivoter texte, images et rectangles autour de leur point (x, y) = coin bas-gauche.
 * On calcule donc ce coin visuel après rotation, puis on applique l'angle (R - rotation) à pdf-lib.
 */
import { localToView, viewToUser } from "../utils/annotationGeometry.js";

export const TEXT_PAD_X = 6; // doit rester identique au padding du textarea (en pt, il suit le zoom)
export const TEXT_PAD_Y = 4;
export const TEXT_LINE_HEIGHT = 1.3;

/**
 * @param {Array} annotations
 * @param {{W:number,H:number,R:number,origin?:{x:number,y:number}}} page  W,H = taille non pivotée ; R = rotation totale
 * @param {Map<string,{width:number,height:number}>} imageSizes  tailles naturelles des images (pour l'ajustement "contain")
 */
export function buildPageOps(annotations, { W, H, R, origin = { x: 0, y: 0 } }, imageSizes = new Map()) {
  const vw = R % 180 === 0 ? W : H;
  const vh = R % 180 === 0 ? H : W;

  const toUser = (ann, lx, ly) => {
    const v = localToView(ann, lx, ly, vw, vh);
    const u = viewToUser(v.x / vw, v.y / vh, W, H, R);
    return { x: u.x + origin.x, y: u.y + origin.y };
  };
  const angle = (ann) => R - (ann.rotation || 0);

  const ops = [];

  for (const ann of annotations || []) {
    const bw = (ann.width / 100) * vw;
    const bh = (ann.height / 100) * vh;

    if (ann.type === "text") {
      if (!ann.text || !String(ann.text).trim()) continue;
      const size = ann.fontSize || 16;
      const o = toUser(ann, TEXT_PAD_X, TEXT_PAD_Y + size);
      ops.push({
        kind: "text",
        text: String(ann.text),
        x: o.x,
        y: o.y,
        size,
        color: ann.color || "#000000",
        rotateDeg: angle(ann),
        maxWidth: Math.max(20, bw - 2 * TEXT_PAD_X),
        lineHeight: size * TEXT_LINE_HEIGHT,
      });
    } else if (ann.type === "drawing" || ann.type === "highlight") {
      const pts = ann.points || [];
      if (!pts.length) continue;
      const isHighlight = ann.type === "highlight";
      const base = {
        kind: "line",
        thickness: ann.strokeWidth || (isHighlight ? 20 : 3),
        color: ann.color || (isHighlight ? "#ffff00" : "#000000"),
        opacity: isHighlight ? 0.35 : 1,
      };
      const P = pts.map((p) => toUser(ann, p.x * bw, p.y * bh));
      if (P.length === 1) {
        ops.push({ ...base, start: P[0], end: P[0] });
      } else {
        for (let i = 0; i < P.length - 1; i++) ops.push({ ...base, start: P[i], end: P[i + 1] });
      }
    } else if ((ann.type === "signature" || ann.type === "image") && ann.dataUrl) {
      // Même logique que l'affichage : object-fit: contain, centré dans la boîte
      const size = imageSizes.get(ann.dataUrl);
      let dw = bw;
      let dh = bh;
      if (size && size.width > 0 && size.height > 0) {
        const ratio = Math.min(bw / size.width, bh / size.height);
        dw = size.width * ratio;
        dh = size.height * ratio;
      }
      const offX = (bw - dw) / 2;
      const offY = (bh - dh) / 2;
      const o = toUser(ann, offX, offY + dh); // coin bas-gauche visuel de l'image
      ops.push({ kind: "image", src: ann.dataUrl, x: o.x, y: o.y, width: dw, height: dh, rotateDeg: angle(ann) });
    } else if (ann.type === "mask") {
      const o = toUser(ann, 0, bh);
      ops.push({
        kind: "rect",
        x: o.x,
        y: o.y,
        width: bw,
        height: bh,
        rotateDeg: angle(ann),
        color: ann.color || "#ffffff",
        opacity: 1,
      });
    }
  }

  return ops;
}
