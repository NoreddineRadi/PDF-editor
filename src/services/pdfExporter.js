import { PDFDocument, StandardFonts, LineCapStyle, degrees, rgb } from 'pdf-lib';
import { createFrame, normalizeAngle, wrapText } from '@/utils/pdfGeometry';
import { dataUrlToBytes } from '@/utils/fileHelpers';

// Doit rester identique au rendu de TextAnnotationOverlay.vue
const TEXT_PADDING_TOP = 4;
const TEXT_PADDING_LEFT = 6;
const TEXT_LINE_HEIGHT = 1.3;
const TEXT_BASELINE_RATIO = 0.997; // position de la ligne de base dans la 1re ligne (en fraction de la taille)

/** Convertisseur Hex (#RGB / #RRGGBB) vers RGB (0 à 1) pour pdf-lib */
function hexToPdfRgb(hexColor) {
  let hex = String(hexColor || '#000000').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const r = parseInt(hex.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(hex.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(hex.substring(4, 6), 16) / 255 || 0;
  return rgb(r, g, b);
}

/** Remplace les caractères que la police standard ne sait pas encoder (évite un crash de pdf-lib) */
function makeSanitizer(font) {
  const supported = new Set(font.getCharacterSet());
  return (text) =>
    Array.from(String(text).replace(/\t/g, '    '))
      .map((ch) => (ch === '\n' || ch === '\r' || supported.has(ch.codePointAt(0)) ? ch : '?'))
      .join('');
}

function drawTextAnnotation(page, font, sanitize, frame, ann) {
  const raw = ann.text || '';
  if (!raw.trim()) return; // les zones de texte vides ne sont pas exportées

  const size = ann.fontSize || 16;
  const boxLeft = (ann.x / 100) * frame.dispW;
  const boxTop = (ann.y / 100) * frame.dispH;
  const boxWidth = (ann.width / 100) * frame.dispW;
  const maxWidth = Math.max(boxWidth - 2 * TEXT_PADDING_LEFT, size);
  const color = hexToPdfRgb(ann.color);

  const lines = wrapText(sanitize(raw), (s) => font.widthOfTextAtSize(s, size), maxWidth);

  lines.forEach((line, i) => {
    if (!line) return;
    const baselineY = boxTop + TEXT_PADDING_TOP + size * TEXT_LINE_HEIGHT * i + size * TEXT_BASELINE_RATIO;
    const { x, y } = frame.toPdf(boxLeft + TEXT_PADDING_LEFT, baselineY);
    page.drawText(line, { x, y, size, font, color, rotate: degrees(frame.R) });
  });
}

function drawStroke(page, frame, ann) {
  const points = ann.points;
  if (!points || points.length === 0) return;

  const isHighlight = ann.type === 'highlight';
  const color = hexToPdfRgb(ann.color);
  const opacity = isHighlight ? 0.35 : 1;
  const thickness = ann.strokeWidth || (isHighlight ? 20 : 3);

  // Les points sont sur une grille 0–1000 du repère affiché
  const mapped = points.map((p) => frame.toPdf((p.x / 1000) * frame.dispW, (p.y / 1000) * frame.dispH));

  if (mapped.length === 1) {
    page.drawCircle({ x: mapped[0].x, y: mapped[0].y, size: thickness / 2, color, opacity });
    return;
  }

  for (let i = 0; i < mapped.length - 1; i++) {
    const a = mapped[i];
    const b = mapped[i + 1];
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.2) continue; // ignore les micro-segments
    page.drawLine({
      start: a,
      end: b,
      thickness,
      color,
      opacity,
      lineCap: LineCapStyle.Round,
    });
  }
}

async function drawSignature(pdfDoc, page, frame, ann, imageCache) {
  if (!ann.dataUrl) return;

  let image = imageCache.get(ann.dataUrl);
  if (!image) {
    image = await pdfDoc.embedPng(dataUrlToBytes(ann.dataUrl));
    imageCache.set(ann.dataUrl, image);
  }

  // Même logique que l'overlay (object-fit: contain, centré dans la boîte)
  const boxLeft = (ann.x / 100) * frame.dispW;
  const boxTop = (ann.y / 100) * frame.dispH;
  const boxW = (ann.width / 100) * frame.dispW;
  const boxH = (ann.height / 100) * frame.dispH;
  const scale = Math.min(boxW / image.width, boxH / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const left = boxLeft + (boxW - w) / 2;
  const top = boxTop + (boxH - h) / 2;

  // pdf-lib ancre l'image par son coin bas-gauche
  const { x, y } = frame.toPdf(left, top + h);
  page.drawImage(image, { x, y, width: w, height: h, rotate: degrees(frame.R) });
}

export default {
  /**
   * Assemble le PDF final (ordre, rotations, annotations).
   * @param {Array} pages Éléments de pagesOrder à exporter
   * @param {Object} documents Documents sources du store ({ [docId]: { arrayBuffer } })
   * @returns {Promise<{ bytes: Uint8Array, warnings: string[] }>}
   */
  async buildPdf(pages, documents) {
    const output = await PDFDocument.create();
    const font = await output.embedFont(StandardFonts.Helvetica);
    const sanitize = makeSanitizer(font);
    const sources = {};
    const imageCache = new Map();
    const warnings = [];

    for (const item of pages) {
      const docObj = documents[item.docId];
      if (!docObj) continue;

      // On ne charge que les documents réellement utilisés
      if (!sources[item.docId]) {
        sources[item.docId] = await PDFDocument.load(docObj.arrayBuffer);
      }

      const [page] = await output.copyPages(sources[item.docId], [item.pageIndex]);

      const nativeRotation = normalizeAngle(page.getRotation().angle);
      const totalRotation = normalizeAngle(nativeRotation + (item.rotation || 0));
      if (totalRotation !== nativeRotation) page.setRotation(degrees(totalRotation));

      const crop = page.getCropBox();
      const frame = createFrame(crop, totalRotation);

      output.addPage(page);

      for (const ann of item.annotations || []) {
        try {
          if (ann.type === 'text') {
            drawTextAnnotation(page, font, sanitize, frame, ann);
          } else if (ann.type === 'drawing' || ann.type === 'highlight') {
            drawStroke(page, frame, ann);
          } else if (ann.type === 'signature') {
            await drawSignature(output, page, frame, ann, imageCache);
          }
        } catch (err) {
          console.warn("Annotation ignorée à l'export :", ann.type, err);
          warnings.push(`Une annotation « ${ann.type} » n'a pas pu être exportée.`);
        }
      }
    }

    const bytes = await output.save();
    return { bytes, warnings };
  },
};
