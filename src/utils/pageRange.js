/**
 * Plage de pages saisie par l'utilisateur ("1-3, 5, 8-10") -> indices 0-based triés, sans doublon.
 * Renvoie null si la saisie est vide ou invalide (caractère inattendu, page hors document, plage inversée).
 * Fonction pure, testable sous Node.
 */
export function parsePageRange(text, pageCount) {
  const src = String(text ?? '').trim().replace(/\s*[-–]\s*/g, '-'); // "4 - 6" -> "4-6"
  if (!src || !Number.isInteger(pageCount) || pageCount < 1) return null;

  const out = new Set();
  for (const raw of src.split(/[,;\s]+/)) {
    if (!raw) continue;
    const m = /^(\d+)(?:-(\d+))?$/.exec(raw);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (a < 1 || b < a || b > pageCount) return null;
    for (let p = a; p <= b; p++) out.add(p - 1);
  }
  return out.size ? [...out].sort((x, y) => x - y) : null;
}
