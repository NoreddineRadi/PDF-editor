/**
 * Générateur de QR code (mode octets / UTF-8, versions 1 à 20, correction d'erreurs L ou M).
 * Fonction pure, sans dépendance ni réseau : utilisée par l'application (Vue) ET par le pré-rendu des pages SEO (Node).
 * Le résultat est validé dans tests/qrcode.test.mjs par un vrai décodeur.
 *
 *   const qr = encodeQr('https://paypal.me/pseudo');   // { size, modules: boolean[][] } (true = module sombre)
 *   qrToSvg(qr)                                         // chaîne <svg> prête à intégrer
 */

const MAX_VERSION = 20;
// Index = version (0 inutilisé)
const ECC_PER_BLOCK = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26],
};
const NUM_BLOCKS = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16],
};
const ECL_BITS = { L: 1, M: 0 };

/* ---------- Arithmétique de Galois (octets, polynôme 0x11D) et Reed-Solomon ---------- */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGalois() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGenerator(degree) {
  // (x - α^0)(x - α^1)…(x - α^(degree-1)), coefficients du plus haut degré (hors terme dominant) au plus bas
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly.slice(1);
}

function rsRemainder(data, gen) {
  const result = new Array(gen.length).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    for (let i = 0; i < gen.length; i++) result[i] ^= gfMul(gen[i], factor);
  }
  return result;
}

/* ---------- Dimensionnement ---------- */
function rawDataModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}

function dataCodewords(ver, ecl) {
  return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];
}

function utf8Bytes(text) {
  return Array.from(new TextEncoder().encode(text));
}

/** Nombre maximal d'octets encodables pour une version et un niveau donnés. */
export function qrCapacity(ver, ecl = 'M') {
  const countBits = ver >= 10 ? 16 : 8;
  return Math.floor((dataCodewords(ver, ecl) * 8 - 4 - countBits) / 8);
}

/* ---------- Construction de la matrice ---------- */
function alignmentPositions(ver) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const size = ver * 4 + 17;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const res = [6];
  for (let pos = size - 7; res.length < n; pos -= step) res.splice(1, 0, pos);
  return res;
}

function bchRemainder(value, poly, bits) {
  let rem = value;
  for (let i = 0; i < bits; i++) rem = (rem << 1) ^ ((rem >>> (bits - 1)) * poly);
  return rem;
}

function makeMatrix(size) {
  return {
    size,
    dark: Array.from({ length: size }, () => new Array(size).fill(false)),
    fn: Array.from({ length: size }, () => new Array(size).fill(false)), // modules de fonction (réservés)
  };
}

function setFn(m, x, y, isDark) {
  m.dark[y][x] = isDark;
  m.fn[y][x] = true;
}

function drawFinder(m, cx, cy) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= m.size || y >= m.size) continue;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      setFn(m, x, y, dist !== 2 && dist !== 4);
    }
  }
}

function drawAlignment(m, cx, cy) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) setFn(m, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
}

function drawFormat(m, ecl, mask) {
  const data = (ECL_BITS[ecl] << 3) | mask;
  const bits = ((data << 10) | bchRemainder(data, 0x537, 10)) ^ 0x5412;
  const bit = (i) => ((bits >>> i) & 1) !== 0;
  // Copie autour du finder en haut à gauche
  for (let i = 0; i <= 5; i++) setFn(m, 8, i, bit(i));
  setFn(m, 8, 7, bit(6));
  setFn(m, 8, 8, bit(7));
  setFn(m, 7, 8, bit(8));
  for (let i = 9; i < 15; i++) setFn(m, 14 - i, 8, bit(i));
  // Seconde copie
  for (let i = 0; i < 8; i++) setFn(m, m.size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setFn(m, 8, m.size - 15 + i, bit(i));
  setFn(m, 8, m.size - 8, true); // module sombre fixe
}

function drawVersion(m, ver) {
  if (ver < 7) return;
  const bits = (ver << 12) | bchRemainder(ver, 0x1f25, 12);
  for (let i = 0; i < 18; i++) {
    const b = ((bits >>> i) & 1) !== 0;
    const a = m.size - 11 + (i % 3);
    const c = Math.floor(i / 3);
    setFn(m, a, c, b);
    setFn(m, c, a, b);
  }
}

function drawFunctionPatterns(m, ver) {
  for (let i = 0; i < m.size; i++) {
    setFn(m, 6, i, i % 2 === 0);
    setFn(m, i, 6, i % 2 === 0);
  }
  drawFinder(m, 3, 3);
  drawFinder(m, m.size - 4, 3);
  drawFinder(m, 3, m.size - 4);
  const pos = alignmentPositions(ver);
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      const last = pos.length - 1;
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      drawAlignment(m, pos[i], pos[j]);
    }
  }
  drawFormat(m, 'L', 0); // réserve la zone (réécrite après choix du masque)
  drawVersion(m, ver);
}

function drawCodewords(m, codewords) {
  let i = 0;
  const totalBits = codewords.length * 8;
  for (let right = m.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < m.size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? m.size - 1 - vert : vert;
        if (!m.fn[y][x] && i < totalBits) {
          m.dark[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(m, mask) {
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (!m.fn[y][x] && MASKS[mask](x, y)) m.dark[y][x] = !m.dark[y][x];
    }
  }
}

function penalty(m) {
  const n = m.size;
  const g = m.dark;
  let score = 0;
  const runScore = (line) => {
    let s = 0;
    let run = 1;
    for (let i = 1; i < n; i++) {
      if (line[i] === line[i - 1]) {
        run++;
        if (run === 5) s += 3;
        else if (run > 5) s++;
      } else run = 1;
    }
    return s;
  };
  const finderLike = (line) => {
    // 1011101 précédé ou suivi de 4 modules clairs
    let s = 0;
    const pat = [true, false, true, true, true, false, true];
    for (let i = 0; i + 7 <= n; i++) {
      let ok = true;
      for (let k = 0; k < 7; k++) if (line[i + k] !== pat[k]) { ok = false; break; }
      if (!ok) continue;
      const lightBefore = i >= 4 && [0, 1, 2, 3].every((k) => !line[i - 1 - k]);
      const lightAfter = i + 7 + 4 <= n && [0, 1, 2, 3].every((k) => !line[i + 7 + k]);
      if (lightBefore || lightAfter) s += 40;
    }
    return s;
  };
  for (let y = 0; y < n; y++) {
    score += runScore(g[y]) + finderLike(g[y]);
    const col = g.map((row) => row[y]);
    score += runScore(col) + finderLike(col);
  }
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      if (g[y][x] === g[y][x + 1] && g[y][x] === g[y + 1][x] && g[y][x] === g[y + 1][x + 1]) score += 3;
    }
  }
  let darkCount = 0;
  for (const row of g) for (const v of row) if (v) darkCount++;
  const pct = (darkCount * 100) / (n * n);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

/**
 * Encode un texte en QR code.
 * @param {string} text
 * @param {{ecl?: 'L'|'M'}} [opts]
 * @returns {{size:number, version:number, modules:boolean[][]}}
 * @throws si le texte ne tient pas dans la version 20
 */
export function encodeQr(text, { ecl = 'M' } = {}) {
  const bytes = utf8Bytes(String(text));
  let ver = 1;
  while (ver <= MAX_VERSION && bytes.length > qrCapacity(ver, ecl)) ver++;
  if (ver > MAX_VERSION) throw new Error('QR : texte trop long');

  // Flux de bits : mode octets (0100), longueur, données, terminaison, remplissage
  const bits = [];
  const push = (value, count) => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, ver >= 10 ? 16 : 8);
  for (const b of bytes) push(b, 8);
  const capBits = dataCodewords(ver, ecl) * 8;
  push(0, Math.min(4, capBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let k = 0; k < 8; k++) v = (v << 1) | bits[i + k];
    data.push(v);
  }
  for (let pad = 0xec; data.length < capBits / 8; pad ^= 0xec ^ 0x11) data.push(pad);

  // Blocs + correction d'erreurs Reed-Solomon, puis entrelacement
  const nBlocks = NUM_BLOCKS[ecl][ver];
  const eccLen = ECC_PER_BLOCK[ecl][ver];
  const rawCodewords = Math.floor(rawDataModules(ver) / 8);
  const nShort = nBlocks - (rawCodewords % nBlocks);
  const shortLen = Math.floor(rawCodewords / nBlocks);
  const gen = rsGenerator(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < nBlocks; i++) {
    const len = shortLen - eccLen + (i < nShort ? 0 : 1);
    const chunk = data.slice(k, k + len);
    k += len;
    blocks.push({ data: chunk, ecc: rsRemainder(chunk, gen) });
  }
  const codewords = [];
  for (let i = 0; i < shortLen - eccLen + 1; i++) {
    for (const b of blocks) if (i < b.data.length) codewords.push(b.data[i]);
  }
  for (let i = 0; i < eccLen; i++) for (const b of blocks) codewords.push(b.ecc[i]);

  // Dessin, choix du masque de pénalité minimale
  const size = ver * 4 + 17;
  const base = makeMatrix(size);
  drawFunctionPatterns(base, ver);
  drawCodewords(base, codewords);

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const m = { size, dark: base.dark.map((r) => r.slice()), fn: base.fn };
    applyMask(m, mask);
    drawFormat(m, ecl, mask);
    const p = penalty(m);
    if (!best || p < best.p) best = { p, dark: m.dark };
  }
  return { size, version: ver, modules: best.dark };
}

/**
 * SVG autonome (fond blanc, zone de silence de 4 modules : indispensable pour que les téléphones le lisent).
 * @param {{size:number, modules:boolean[][]}} qr
 */
export function qrToSvg(qr, { border = 4, label = 'QR code' } = {}) {
  const total = qr.size + border * 2;
  let d = '';
  for (let y = 0; y < qr.size; y++) {
    let x = 0;
    while (x < qr.size) {
      if (!qr.modules[y][x]) { x++; continue; }
      let run = 1;
      while (x + run < qr.size && qr.modules[y][x + run]) run++;
      d += `M${x + border} ${y + border}h${run}v1h-${run}z`;
      x += run;
    }
  }
  const safe = String(label).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="${safe}"><rect width="${total}" height="${total}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
