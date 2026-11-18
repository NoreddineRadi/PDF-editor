import {
  PDFDocument,
  StandardFonts,
  LineCapStyle,
  degrees,
  rgb,
} from 'pdf-lib';
import { buildPageOps } from './annotationOps.js';
import { normalizeRightAngle } from '../utils/annotationGeometry.js';

function hexToPdfRgb(hexColor) {
  const hex = (hexColor || '#000000').replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  const r = parseInt(full.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(full.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(full.substring(4, 6), 16) / 255 || 0;
  return rgb(r, g, b);
}

// Helvetica (WinAnsi) ne sait pas encoder tous les caractères : on remplace ceux qui ne passent pas
function safeText(font, text) {
  let out = '';
  for (const ch of String(text ?? '')) {
    if (ch === '\n') {
      out += ch;
      continue;
    }
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += '?';
    }
  }
  return out;
}

async function embedImage(doc, dataUrl, cache) {
  if (cache.has(dataUrl)) return cache.get(dataUrl);
  const bytes = await fetch(dataUrl).then((res) => res.arrayBuffer());
  const isJpeg = /^data:image\/jpe?g/i.test(dataUrl);
  const img = isJpeg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
  cache.set(dataUrl, img);
  return img;
}

function applyOps(page, ops, { font, images }) {
  for (const op of ops) {
    if (op.kind === 'text') {
      page.drawText(safeText(font, op.text), {
        x: op.x,
        y: op.y,
        size: op.size,
        font,
        color: hexToPdfRgb(op.color),
        lineHeight: op.lineHeight,
        maxWidth: op.maxWidth,
        rotate: degrees(op.rotateDeg),
      });
    } else if (op.kind === 'line') {
      page.drawLine({
        start: op.start,
        end: op.end,
        thickness: op.thickness,
        color: hexToPdfRgb(op.color),
        opacity: op.opacity,
        lineCap: LineCapStyle.Round,
      });
    } else if (op.kind === 'rect') {
      page.drawRectangle({
        x: op.x,
        y: op.y,
        width: op.width,
        height: op.height,
        rotate: degrees(op.rotateDeg),
        color: hexToPdfRgb(op.color),
        opacity: op.opacity,
        borderWidth: 0,
      });
    } else if (op.kind === 'image') {
      const img = images.get(op.src);
      if (!img) continue;
      page.drawImage(img, {
        x: op.x,
        y: op.y,
        width: op.width,
        height: op.height,
        rotate: degrees(op.rotateDeg),
      });
    }
  }
}

/**
 * Génère le PDF final.
 * @param {{pagesToExport: Array, documents: Object}} params  pagesToExport : éléments de pagesOrder (dans l'ordre voulu)
 * @returns {Promise<Uint8Array>}
 */
export async function exportPdfBytes({ pagesToExport, documents }) {
  const outputPdf = await PDFDocument.create();
  const font = await outputPdf.embedFont(StandardFonts.Helvetica);
  const loadedSourceDocs = {};
  const imageCache = new Map();

  for (const item of pagesToExport) {
    if (!loadedSourceDocs[item.docId]) {
      loadedSourceDocs[item.docId] = await PDFDocument.load(
        documents[item.docId].arrayBuffer,
      );
    }
    const [copiedPage] = await outputPdf.copyPages(
      loadedSourceDocs[item.docId],
      [item.pageIndex],
    );

    const nativeRotation = normalizeRightAngle(copiedPage.getRotation().angle);
    const R = normalizeRightAngle(nativeRotation + (item.rotation || 0));
    if (R !== nativeRotation) copiedPage.setRotation(degrees(R));

    const page = outputPdf.addPage(copiedPage);

    // pdf.js affiche le CropBox : on se cale dessus (et sur son origine)
    const crop = page.getCropBox();
    const annotations = item.annotations || [];

    // Images : on les intègre d'abord (leur taille naturelle sert à l'ajustement "contain")
    const images = new Map();
    const imageSizes = new Map();
    for (const ann of annotations) {
      if (
        (ann.type === 'signature' || ann.type === 'image') &&
        ann.dataUrl &&
        !images.has(ann.dataUrl)
      ) {
        const img = await embedImage(outputPdf, ann.dataUrl, imageCache);
        images.set(ann.dataUrl, img);
        imageSizes.set(ann.dataUrl, { width: img.width, height: img.height });
      }
    }

    const ops = buildPageOps(
      annotations,
      { W: crop.width, H: crop.height, R, origin: { x: crop.x, y: crop.y } },
      imageSizes,
    );
    applyOps(page, ops, { font, images });
  }

  return await outputPdf.save();
}

export function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
