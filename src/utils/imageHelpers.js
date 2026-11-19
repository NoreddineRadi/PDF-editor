/**
 * Import d'images (PNG, JPG ; WebP et GIF sont convertis en PNG).
 * Les images trop grandes sont réduites pour limiter la mémoire et la taille du PDF exporté.
 * Seul le format de sortie (data URL "image/png" ou "image/jpeg") compte pour l'export : pdf-lib ne sait intégrer que ces deux-là.
 */

// Les messages sont traduits à l'affichage (clé i18n portée par l'erreur) : ce module reste sans dépendance
const imageError = (key) => Object.assign(new Error(key), { i18nKey: key });

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const MAX_IMAGE_DIMENSION = 2000; // px, sur le plus grand côté
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(imageError('err.readFile'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(imageError('err.imageCorrupt'));
    img.src = src;
  });
}

/**
 * @param {File} file
 * @returns {Promise<{dataUrl:string,width:number,height:number,mime:string}>}
 */
export async function loadImageFile(file, { maxDim = MAX_IMAGE_DIMENSION } = {}) {
  if (!file || !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw imageError('err.imageFormat');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw imageError('err.imageTooBig');
  }

  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  if (!w0 || !h0) throw imageError('err.imageEmpty');

  const isNative = file.type === 'image/png' || file.type === 'image/jpeg';
  if (isNative && Math.max(w0, h0) <= maxDim) {
    // Déjà dans un format intégrable et de taille raisonnable : on garde le fichier tel quel (aucune perte)
    return { dataUrl: original, width: w0, height: h0, mime: file.type };
  }

  const scale = Math.min(1, maxDim / Math.max(w0, h0));
  const width = Math.max(1, Math.round(w0 * scale));
  const height = Math.max(1, Math.round(h0 * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const asJpeg = file.type === 'image/jpeg';
  if (asJpeg) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);

  const mime = asJpeg ? 'image/jpeg' : 'image/png';
  return { dataUrl: canvas.toDataURL(mime, 0.92), width, height, mime };
}

/**
 * Boîte initiale d'une image sur la page : tient dans `ratio` (40 %) de la page, proportions respectées, centrée.
 * @returns {{x:number,y:number,width:number,height:number}} en % de la page
 */
export function fitImageBox(imgW, imgH, pageW, pageH, ratio = 0.4) {
  const scale = Math.min((pageW * ratio) / imgW, (pageH * ratio) / imgH);
  const width = ((imgW * scale) / pageW) * 100;
  const height = ((imgH * scale) / pageH) * 100;
  return { x: (100 - width) / 2, y: (100 - height) / 2, width, height };
}
