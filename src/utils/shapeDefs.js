/**
 * Formes et symboles : UNE SEULE définition, utilisée par l'affichage (SVG) et par l'export (pdf-lib).
 * C'est ce qui garantit que ce qui est affiché est ce qui est gravé dans le PDF.
 *
 * Chaque figure est une liste de "primitives" dessinées dans une boîte unité [0,1] x [0,1] (haut-gauche = 0,0).
 * Une primitive = { segs, fill, stroke } avec :
 *   segs   : ['M',x,y] | ['L',x,y] | ['C',x1,y1,x2,y2,x,y] | ['Z']
 *   fill   : 'none' | 'color' (couleur du trait) | 'fillColor' (couleur de remplissage de la forme, si définie)
 *   stroke : true -> contour dans la couleur de l'élément
 * Fonction pure, sans dépendance : testable sous Node.
 */

export const SHAPE_KINDS = ['rect', 'ellipse', 'triangle'];
export const SYMBOL_KINDS = ['checkbox', 'checkbox-checked', 'radio', 'radio-checked', 'check', 'bullet'];

// Constante des courbes de Bézier cubiques approchant un quart de cercle
const K = 0.5522847498;

function polySegs(pts, closed) {
  const segs = pts.map((p, i) => [i === 0 ? 'M' : 'L', p[0], p[1]]);
  if (closed) segs.push(['Z']);
  return segs;
}

const rectSegs = (x0, y0, x1, y1) =>
  polySegs([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true);

function ellipseSegs(cx, cy, rx, ry) {
  return [
    ['M', cx + rx, cy],
    ['C', cx + rx, cy + K * ry, cx + K * rx, cy + ry, cx, cy + ry],
    ['C', cx - K * rx, cy + ry, cx - rx, cy + K * ry, cx - rx, cy],
    ['C', cx - rx, cy - K * ry, cx - K * rx, cy - ry, cx, cy - ry],
    ['C', cx + K * rx, cy - ry, cx + rx, cy - K * ry, cx + rx, cy],
    ['Z'],
  ];
}

const CHECK_MARK = polySegs([[0.17, 0.55], [0.4, 0.79], [0.84, 0.21]], false);

/** Primitives d'une annotation de type "shape" ou "symbol". */
export function getPrimitives(ann) {
  if (ann.type === 'shape') {
    switch (ann.shape) {
      case 'ellipse':
        return [{ segs: ellipseSegs(0.5, 0.5, 0.5, 0.5), fill: 'fillColor', stroke: true }];
      case 'triangle':
        return [{ segs: polySegs([[0.5, 0], [1, 1], [0, 1]], true), fill: 'fillColor', stroke: true }];
      default:
        return [{ segs: rectSegs(0, 0, 1, 1), fill: 'fillColor', stroke: true }];
    }
  }

  if (ann.type === 'symbol') {
    const box = { segs: rectSegs(0.08, 0.08, 0.92, 0.92), fill: 'none', stroke: true };
    const circle = { segs: ellipseSegs(0.5, 0.5, 0.42, 0.42), fill: 'none', stroke: true };
    switch (ann.symbol) {
      case 'checkbox':
        return [box];
      case 'checkbox-checked':
        return [box, { segs: CHECK_MARK, fill: 'none', stroke: true }];
      case 'radio':
        return [circle];
      case 'radio-checked':
        return [circle, { segs: ellipseSegs(0.5, 0.5, 0.2, 0.2), fill: 'color', stroke: false }];
      case 'check':
        return [{ segs: CHECK_MARK, fill: 'none', stroke: true }];
      case 'bullet':
        return [{ segs: ellipseSegs(0.5, 0.5, 0.28, 0.28), fill: 'color', stroke: false }];
      default:
        return [];
    }
  }
  return [];
}

/** Couleurs effectives d'une primitive : { fill: '#rrggbb' | null, stroke: '#rrggbb' | null } */
export function resolvePaint(prim, ann) {
  const color = ann.color || '#000000';
  let fill = null;
  if (prim.fill === 'color') fill = color;
  else if (prim.fill === 'fillColor') fill = ann.fill || null;
  return { fill, stroke: prim.stroke ? color : null };
}

/** Chemin SVG (coordonnées unité) pour l'affichage. */
export function segsToSvgPath(segs) {
  return segs.map((s) => (s.length === 1 ? s[0] : `${s[0]} ${s.slice(1).join(' ')}`)).join(' ');
}

/**
 * Aplatit un chemin en polylignes (courbes échantillonnées) : sert à la gomme (zone touchée).
 * @returns {{pts:number[][], closed:boolean}[]}
 */
export function flattenSegs(segs, steps = 12) {
  const out = [];
  let cur = null;
  let last = null;
  for (const s of segs) {
    if (s[0] === 'M') {
      cur = { pts: [[s[1], s[2]]], closed: false };
      out.push(cur);
      last = [s[1], s[2]];
    } else if (s[0] === 'L' && cur) {
      cur.pts.push([s[1], s[2]]);
      last = [s[1], s[2]];
    } else if (s[0] === 'C' && cur) {
      const [x0, y0] = last;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        cur.pts.push([
          u * u * u * x0 + 3 * u * u * t * s[1] + 3 * u * t * t * s[3] + t * t * t * s[5],
          u * u * u * y0 + 3 * u * u * t * s[2] + 3 * u * t * t * s[4] + t * t * t * s[6],
        ]);
      }
      last = [s[5], s[6]];
    } else if (s[0] === 'Z' && cur) {
      cur.closed = true;
    }
  }
  return out;
}
