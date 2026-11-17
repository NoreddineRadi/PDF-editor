import * as pdfjsLib from 'pdfjs-dist';
import { toRaw } from 'vue';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

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
   * Dimensions (px CSS) de la page affichée, rotation incluse
   */
  getViewportSize(page, scale = 1.0, rotation = 0) {
    const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
    return { width: Math.floor(viewport.width), height: Math.floor(viewport.height) };
  },

  /**
   * Effectue le rendu sur le canvas.
   * `rotation` = rotation ajoutée par l'utilisateur ; elle s'ajoute à la rotation native de la page
   * (comme à l'export), sinon l'affichage et le PDF exporté ne concordent pas.
   */
  renderPage(page, canvas, scale = 1.0, rotation = 0) {
    const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
    const context = canvas.getContext('2d');

    // Dimensions physiques du canvas
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    // Styles d'affichage CSS explicites
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    // pdf.js >= 5 attend `canvas` ; `canvasContext` reste passé pour les versions plus anciennes
    return page.render({
      canvas,
      canvasContext: context,
      viewport
    });
  }
};
