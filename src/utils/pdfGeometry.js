/**
 * Géométrie PDF.
 *
 * Les annotations sont stockées dans le repère AFFICHÉ (origine en haut à gauche,
 * y vers le bas, page déjà tournée). pdf-lib dessine dans le repère NATIF de la page
 * (origine en bas à gauche, y vers le haut, page non tournée).
 * Ce module pur (sans dépendance) convertit de l'un à l'autre.
 */

export function normalizeAngle(angle) {
  return (((angle || 0) % 360) + 360) % 360;
}

/**
 * @param {{x:number,y:number,width:number,height:number}} box CropBox (ou MediaBox) non tournée
 * @param {number} rotation Rotation TOTALE affichée (rotation native + rotation utilisateur)
 */
export function createFrame(box, rotation) {
  const R = normalizeAngle(rotation);
  const { x: x0, y: y0, width: W, height: H } = box;
  const swapped = R === 90 || R === 270;
  const dispW = swapped ? H : W;
  const dispH = swapped ? W : H;

  /** dx, dy : distances en points depuis le coin haut-gauche de la page affichée */
  function toPdf(dx, dy) {
    const u = dx / dispW;
    const v = dy / dispH;
    let X;
    let Y;
    switch (R) {
      case 90:
        X = v * W;
        Y = u * H;
        break;
      case 180:
        X = (1 - u) * W;
        Y = v * H;
        break;
      case 270:
        X = (1 - v) * W;
        Y = (1 - u) * H;
        break;
      default:
        X = u * W;
        Y = (1 - v) * H;
    }
    return { x: x0 + X, y: y0 + Y };
  }

  return { R, W, H, dispW, dispH, toPdf };
}

/**
 * Retour à la ligne glouton (mots, puis caractères pour les mots trop longs).
 * @param {string} text
 * @param {(s:string)=>number} measure Largeur en points d'une chaîne
 * @param {number} maxWidth
 * @returns {string[]}
 */
export function wrapText(text, measure, maxWidth) {
  const out = [];
  for (const paragraph of String(text).split(/\r?\n/)) {
    if (!paragraph) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      if (measure(word) <= maxWidth) {
        line = word;
        continue;
      }
      let chunk = '';
      for (const ch of word) {
        if (chunk && measure(chunk + ch) > maxWidth) {
          out.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      line = chunk;
    }
    out.push(line);
  }
  return out;
}
