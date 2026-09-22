import * as pdfjsLib from 'pdfjs-dist';
import { toRaw } from 'vue';

// Configuration du Worker PDF.js 100% compatible Vite & v4
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default {
  /**
   * Charge le document PDF sans conflit de Proxy Vue
   */
  async loadDocument(data) {
    const rawData = toRaw(data);
    const bytes = rawData instanceof Uint8Array ? rawData : new Uint8Array(rawData);

    // .slice(0) évite tout détachement d'ArrayBuffer lors du passage au Worker
    const loadingTask = pdfjsLib.getDocument({
      data: bytes.slice(0)
    });
    return await loadingTask.promise;
  },

  /**
   * Récupère la page de manière sécurisée
   */
  async getPage(pdfDocument, pageNumber) {
    const rawDoc = toRaw(pdfDocument);
    return await rawDoc.getPage(pageNumber);
  },

  /**
   * Effectue le rendu sur le canvas
   */
  renderPage(page, canvas, scale = 1.0, rotation = 0) {
    const viewport = page.getViewport({ scale, rotation });
    const context = canvas.getContext('2d');

    // Dimensions physiques du canvas
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    // Styles d'affichage CSS explicites
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    return page.render({
      canvasContext: context,
      viewport: viewport
    });
  }
};