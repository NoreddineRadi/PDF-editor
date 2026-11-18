import { defineStore } from 'pinia';
import { markRaw, toRaw } from 'vue';
import pdfReaderService from '@/services/pdfReader';
import { exportPdfBytes, downloadBytes } from '@/services/pdfExporter';
import { loadImageFile, fitImageBox } from '@/utils/imageHelpers';

const HISTORY_LIMIT = 100;
const STYLE_KEYS = ['fontSize', 'color', 'strokeWidth'];

// Outils pour lesquels une sélection reste visible / utilisable
const SELECTION_TOOLS = ['select', 'text'];

// Historique : état hors réactivité (évite de re-déclencher des rendus à chaque frappe)
let lastCoalesceKey = null;
let lastCoalesceTime = 0;
let groupState = null; // null | 'pending' | 'open' : regroupe plusieurs suppressions en une seule étape

/**
 * Instantané des annotations de toutes les pages. Les annotations sont IMMUABLES (on remplace
 * l'objet à chaque modification), donc on partage les références sans copier les images (dataUrl).
 */
function snapshotPages(pagesOrder) {
  const snap = {};
  for (const p of pagesOrder)
    snap[p.id] = (p.annotations || []).map((a) => toRaw(a));
  return markRaw(snap);
}

export const usePdfStore = defineStore('pdf', {
  state: () => ({
    documents: {},
    pagesOrder: [], // Array<{ id, docId, pageIndex, rotation, selected, annotations: [] }>
    currentPageIndex: 0,
    zoomLevel: 1.0,
    isLoading: false,

    // Taille (px) de la page affichée : renseignée par PdfViewer, sert à dimensionner les éléments insérés
    pageViewport: { width: 0, height: 0 },
    // Message à afficher (toast) : { severity, summary, detail } ; remplacé à chaque notification
    notice: null,

    // Outils
    activeTool: 'select', // 'select' | 'text' | 'draw' | 'highlight' | 'eraser' | 'mask'
    selectedAnnotationId: null,
    annotationColor: '#000000',
    strokeWidth: 3, // crayon : px à l'écran (converti en points PDF à la création)
    fontSize: 16,
    highlightColor: '#FFFF00',
    highlightWidth: 20, // surligneur : épaisseur en px de page (indépendante du zoom)
    maskColor: '#ffffff', // Blanco : blanc par défaut ; 'auto' = couleur du fond de la page ; sinon #RRGGBB

    // Historique (annuler / rétablir)
    undoStack: [],
    redoStack: [],
  }),

  getters: {
    hasDocument: (state) => state.pagesOrder.length > 0,
    pageCount: (state) => state.pagesOrder.length,
    currentPage: (state) => state.currentPageIndex + 1,
    formattedZoom: (state) => `${Math.round(state.zoomLevel * 100)}%`,
    currentPageData: (state) =>
      state.pagesOrder[state.currentPageIndex] || null,
    selectedPages: (state) => state.pagesOrder.filter((p) => p.selected),
    selectedCount: (state) => state.pagesOrder.filter((p) => p.selected).length,
    hasSelection: (state) => state.pagesOrder.some((p) => p.selected),
    canUndo: (state) => state.undoStack.length > 0,
    canRedo: (state) => state.redoStack.length > 0,
    selectedAnnotation(state) {
      const page = state.pagesOrder[state.currentPageIndex];
      if (!page || !state.selectedAnnotationId) return null;
      return (
        (page.annotations || []).find(
          (a) => a.id === state.selectedAnnotationId,
        ) || null
      );
    },
  },

  actions: {
    notify(severity, summary, detail = '') {
      this.notice = { severity, summary, detail, at: Date.now() };
    },
    setPageViewport(width, height) {
      if (this.pageViewport.width !== width || this.pageViewport.height !== height) {
        this.pageViewport = { width, height };
      }
    },

    /** Insère une image (PNG/JPG) au centre de la page courante, prête à être déplacée / redimensionnée / pivotée. */
    async addImageFromFile(file) {
      if (!this.currentPageData) return;
      try {
        const img = await loadImageFile(file);
        const { width: pw, height: ph } = this.pageViewport;
        const box = fitImageBox(img.width, img.height, pw || 800, ph || 1130);
        this.setTool('select');
        this.addAnnotationToCurrentPage(
          { type: 'image', dataUrl: img.dataUrl, ...box, rotation: 0 },
          { select: true },
        );
      } catch (err) {
        this.notify('error', 'Image non ajoutée', err?.message || String(err));
      }
    },

    async addFiles(files) {
      if (!files || files.length === 0) return;
      this.isLoading = true;

      try {
        for (const file of files) {
          const arrayBuffer = await file.arrayBuffer();
          // loadDocument travaille sur une copie : arrayBuffer reste intact pour pdf-lib à l'export
          const pdfJsDoc = await pdfReaderService.loadDocument(arrayBuffer);
          const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

          // markRaw : l'objet pdf.js ne doit jamais être enveloppé dans un Proxy Vue
          this.documents[docId] = markRaw({
            id: docId,
            name: file.name,
            pdfJsDoc,
            arrayBuffer,
          });

          for (let i = 0; i < pdfJsDoc.numPages; i++) {
            this.pagesOrder.push({
              id: `page_${docId}_${i}_${Math.random().toString(36).substring(2, 7)}`,
              docId,
              pageIndex: i,
              rotation: 0,
              selected: false,
              annotations: [],
            });
          }
        }
      } catch (err) {
        console.error("Erreur lors de l'ajout des fichiers PDF :", err);
        this.notify('error', 'Import impossible', 'Impossible de lire ce PDF : ' + (err?.message || err));
      } finally {
        this.isLoading = false;
      }
    },

    /* ---------- OUTILS ---------- */
    setTool(tool) {
      this.activeTool = tool;
      if (!SELECTION_TOOLS.includes(tool)) this.selectedAnnotationId = null;
    },
    selectAnnotation(id) {
      this.selectedAnnotationId = id;
    },
    setAnnotationColor(color) {
      this.annotationColor = color;
      const sel = this.selectedAnnotation;
      if (sel && (sel.type === 'text' || sel.type === 'drawing'))
        this.updateAnnotation({ id: sel.id, color });
    },
    setStrokeWidth(width) {
      this.strokeWidth = width;
      const sel = this.selectedAnnotation;
      if (sel && sel.type === 'drawing')
        this.updateAnnotation({
          id: sel.id,
          strokeWidth: width / this.zoomLevel,
        });
    },
    setHighlightColor(color) {
      this.highlightColor = color;
      const sel = this.selectedAnnotation;
      if (sel && sel.type === 'highlight')
        this.updateAnnotation({ id: sel.id, color });
    },
    setHighlightWidth(width) {
      this.highlightWidth = width;
      const sel = this.selectedAnnotation;
      if (sel && sel.type === 'highlight')
        this.updateAnnotation({ id: sel.id, strokeWidth: width });
    },
    setMaskColor(color) {
      this.maskColor = color;
      const sel = this.selectedAnnotation;
      if (sel && sel.type === 'mask' && color !== 'auto')
        this.updateAnnotation({ id: sel.id, color });
    },

    /* ---------- HISTORIQUE ---------- */
    pushHistory(coalesceKey = null) {
      if (groupState === 'open') return;
      if (groupState === 'pending') groupState = 'open';

      const now = Date.now();
      // Frappes / réglages répétés sur un même élément : une seule étape d'annulation
      if (
        coalesceKey &&
        coalesceKey === lastCoalesceKey &&
        now - lastCoalesceTime < 1200
      ) {
        lastCoalesceTime = now;
        return;
      }
      lastCoalesceKey = coalesceKey;
      lastCoalesceTime = now;

      this.undoStack.push(
        markRaw({
          snap: snapshotPages(this.pagesOrder),
          pageId: this.currentPageData?.id ?? null,
        }),
      );
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
      this.redoStack = [];
    },
    beginHistoryGroup() {
      groupState = 'pending';
    },
    endHistoryGroup() {
      groupState = null;
    },
    applyHistoryEntry(entry) {
      for (const p of this.pagesOrder) {
        const list = entry.snap[p.id];
        if (list) p.annotations = list.slice();
      }
      const idx = this.pagesOrder.findIndex((p) => p.id === entry.pageId);
      if (idx !== -1) this.currentPageIndex = idx;
      if (!this.selectedAnnotation) this.selectedAnnotationId = null;
      lastCoalesceKey = null;
    },
    undo() {
      const entry = this.undoStack.pop();
      if (!entry) return;
      this.redoStack.push(
        markRaw({ snap: snapshotPages(this.pagesOrder), pageId: entry.pageId }),
      );
      this.applyHistoryEntry(entry);
    },
    redo() {
      const entry = this.redoStack.pop();
      if (!entry) return;
      this.undoStack.push(
        markRaw({ snap: snapshotPages(this.pagesOrder), pageId: entry.pageId }),
      );
      this.applyHistoryEntry(entry);
    },
    undoLastAnnotation() {
      this.undo();
    },

    /* ---------- ANNOTATIONS ---------- */
    /** Ajoute une annotation à la page courante et renvoie son id. */
    addAnnotationToCurrentPage(annotation, { select = false } = {}) {
      const page = this.currentPageData;
      if (!page) return null;
      if (!page.annotations) page.annotations = [];
      this.pushHistory(null);
      const id = `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      page.annotations.push({ rotation: 0, ...annotation, id });
      if (select) this.selectedAnnotationId = id;
      return id;
    },
    /** Fusionne `updated` (doit contenir `id`) dans l'annotation correspondante de la page courante. */
    updateAnnotation(updated) {
      const list = this.currentPageData?.annotations;
      if (!list) return;
      const index = list.findIndex((a) => a.id === updated.id);
      if (index === -1) return;
      const old = list[index];
      const changed = Object.keys(updated).filter(
        (k) => k !== 'id' && updated[k] !== old[k],
      );
      if (!changed.length) return;

      let key = null;
      if (changed.every((k) => k === 'text')) key = `text:${old.id}`;
      else if (changed.every((k) => STYLE_KEYS.includes(k)))
        key = `style:${old.id}`;
      this.pushHistory(key);

      list[index] = { ...toRaw(old), ...updated };
    },
    removeAnnotation(id, { history = true } = {}) {
      const page = this.currentPageData;
      if (!page?.annotations || !page.annotations.some((a) => a.id === id))
        return;
      if (history) this.pushHistory(null);
      page.annotations = page.annotations.filter((a) => a.id !== id);
      if (this.selectedAnnotationId === id) this.selectedAnnotationId = null;
    },

    /* ---------- PAGES ---------- */
    setPage(pageNumber) {
      if (pageNumber >= 1 && pageNumber <= this.pagesOrder.length) {
        this.currentPageIndex = pageNumber - 1;
      }
    },
    rotatePage(index) {
      if (this.pagesOrder[index])
        this.pagesOrder[index].rotation =
          (this.pagesOrder[index].rotation + 90) % 360;
    },
    deletePage(index) {
      if (index >= 0 && index < this.pagesOrder.length) {
        this.pagesOrder.splice(index, 1);
        if (this.currentPageIndex >= this.pagesOrder.length) {
          this.currentPageIndex = Math.max(0, this.pagesOrder.length - 1);
        }
      }
    },
    togglePageSelection(index) {
      if (this.pagesOrder[index])
        this.pagesOrder[index].selected = !this.pagesOrder[index].selected;
    },
    selectAllPages(selectAll = true) {
      this.pagesOrder.forEach((p) => (p.selected = selectAll));
    },
    reorderPages(newOrder) {
      this.pagesOrder = newOrder;
    },
    clearAll() {
      this.documents = {};
      this.pagesOrder = [];
      this.currentPageIndex = 0;
      this.selectedAnnotationId = null;
      this.undoStack = [];
      this.redoStack = [];
    },

    /* ---------- EXPORT ---------- */
    async exportPdf(onlySelected = false) {
      if (!this.hasDocument) return;
      const pagesToExport = onlySelected ? this.selectedPages : this.pagesOrder;
      if (pagesToExport.length === 0) return;

      this.isLoading = true;
      try {
        const bytes = await exportPdfBytes({
          pagesToExport,
          documents: this.documents,
        });
        downloadBytes(bytes, `pdf_annotated_${Date.now()}.pdf`);
      } catch (err) {
        console.error("Erreur lors de l'exportation du PDF :", err);
        this.notify('error', 'Export impossible', "Erreur lors de l'exportation : " + (err?.message || err));
      } finally {
        this.isLoading = false;
      }
    },

    /* ---------- ZOOM ---------- */
    setZoomLevel(zoom) {
      this.zoomLevel = zoom;
    },
    zoomIn() {
      this.setZoomLevel(
        Math.min(3.0, Math.round((this.zoomLevel + 0.15) * 100) / 100),
      );
    },
    zoomOut() {
      this.setZoomLevel(
        Math.max(0.4, Math.round((this.zoomLevel - 0.15) * 100) / 100),
      );
    },
  },
});
