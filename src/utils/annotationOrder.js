/**
 * Ordre d'empilement et duplication des annotations (fonctions pures, testables sous Node).
 * L'ordre du tableau EST l'ordre d'empilement : le dernier élément est au premier plan.
 */

/**
 * @param {Array} list
 * @param {string} id
 * @param {'front'|'back'|'forward'|'backward'} mode
 * @returns {Array|null} nouveau tableau, ou null si rien ne change
 */
export function reorderList(list, id, mode) {
  const i = list.findIndex((a) => a.id === id);
  if (i === -1) return null;
  let j = i;
  if (mode === 'front') j = list.length - 1;
  else if (mode === 'back') j = 0;
  else if (mode === 'forward') j = Math.min(list.length - 1, i + 1);
  else if (mode === 'backward') j = Math.max(0, i - 1);
  if (j === i) return null;

  const next = list.slice();
  const [item] = next.splice(i, 1);
  next.splice(j, 0, item);
  return next;
}

/** Copie décalée (en % de la page) ; revient en arrière si la copie sortirait de la page. */
export function offsetCopy(ann, offset = 2) {
  const copy = { ...ann };
  copy.x = ann.x + offset + ann.width > 100 ? Math.max(0, ann.x - offset) : ann.x + offset;
  copy.y = ann.y + offset + ann.height > 100 ? Math.max(0, ann.y - offset) : ann.y + offset;
  return copy;
}

/** Déplacement au clavier : le centre de l'élément reste dans la page. */
export function nudgePosition(ann, dx, dy) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const cx = clamp(ann.x + ann.width / 2 + dx, 0, 100);
  const cy = clamp(ann.y + ann.height / 2 + dy, 0, 100);
  return { x: cx - ann.width / 2, y: cy - ann.height / 2 };
}
