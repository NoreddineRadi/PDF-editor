import { defineStore } from 'pinia';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, degrees, rgb } from 'pdf-lib';

// Convertisseur Hex (#RRGGBB) vers RGB (0 à 1) pour pdf-lib
function hexToPdfRgb(hexColor) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(hex.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(hex.substring(4, 6), 16) / 255 || 0;
  return rgb(r, g, b);
}

export const usePdfStore = defineStore('pdf', {
  state: () => ({
    documents: {},
    pagesOrder: [], // Array<{ id, docId, pageIndex, rotation, selected, annotations: [] }>
    currentPageIndex: 0,
    zoomLevel: 1.0,
    isLoading: false,

    // Outils d'annotation actifs
    activeTool: 'select', // 'select' | 'text' | 'draw' | 'highlight'
    strokeWidth: 3,
    fontSize: 16,
    showSignatureModal: false,
    annotations: [], // Tableau global des annotations
    activeTool: 'select',
    annotationColor: '#000000',
    strokeWidth: 3,
  }),

  getters: {
    hasDocument: (state) => state.pagesOrder.length > 0,
    pageCount: (state) => state.pagesOrder.length,
    currentPage: (state) => state.currentPageIndex + 1,
    formattedZoom: (state) => `${Math.round(state.zoomLevel * 100)}%`,
    currentPageData: (state) => state.pagesOrder[state.currentPageIndex] || null,
    selectedPages: (state) => state.pagesOrder.filter(p => p.selected),
    selectedCount: (state) => state.pagesOrder.filter(p => p.selected).length,
    hasSelection: (state) => state.pagesOrder.some(p => p.selected)
  },

  actions: {
    async addFiles(files) {
      if (!files || files.length === 0) return;
      this.isLoading = true;

      try {
        for (const file of files) {
          const arrayBuffer = await file.arrayBuffer();
          const bufferCopy = arrayBuffer.slice(0);
          const pdfJsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
          const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          
          this.documents[docId] = { id: docId, name: file.name, pdfJsDoc, arrayBuffer: bufferCopy };

          for (let i = 0; i < pdfJsDoc.numPages; i++) {
            this.pagesOrder.push({
              id: `page_${docId}_${i}_${Math.random().toString(36).substring(2, 7)}`,
              docId,
              pageIndex: i,
              rotation: 0,
              selected: false,
              annotations: [] // Tableau pour stocker les annotations de la page
            });
          }
        }
      } catch (err) {
        console.error("Erreur lors de l'ajout des fichiers PDF :", err);
      } finally {
        this.isLoading = false;
      }
    },

    setTool(tool) {
      this.activeTool = tool;
    },

    setAnnotationColor(color) {
      this.annotationColor = color;
    },
    undoLastAnnotation() {
      if (this.currentPageData?.annotations?.length > 0) {
        this.currentPageData.annotations.pop();
      }
    },

    setPage(pageNumber) {
      if (pageNumber >= 1 && pageNumber <= this.pagesOrder.length) {
        this.currentPageIndex = pageNumber - 1;
      }
    },
    rotatePage(index) { if (this.pagesOrder[index]) this.pagesOrder[index].rotation = (this.pagesOrder[index].rotation + 90) % 360; },
    deletePage(index) {
      if (index >= 0 && index < this.pagesOrder.length) {
        this.pagesOrder.splice(index, 1);
        if (this.currentPageIndex >= this.pagesOrder.length) {
          this.currentPageIndex = Math.max(0, this.pagesOrder.length - 1);
        }
      }
    },
    togglePageSelection(index) { if (this.pagesOrder[index]) this.pagesOrder[index].selected = !this.pagesOrder[index].selected; },
    selectAllPages(selectAll = true) { this.pagesOrder.forEach(p => p.selected = selectAll); },
    reorderPages(newOrder) { this.pagesOrder = newOrder; },
    clearAll() { this.documents = {}; this.pagesOrder = []; this.currentPageIndex = 0; },
    async exportPdf(onlySelected = false) {
      if (!this.hasDocument) return;
      const pagesToExport = onlySelected ? this.selectedPages : this.pagesOrder;
      if (pagesToExport.length === 0) return;

      this.isLoading = true;

      try {
        const outputPdf = await PDFDocument.create();
        const loadedSourceDocs = {};

        for (const docId in this.documents) {
          loadedSourceDocs[docId] = await PDFDocument.load(this.documents[docId].arrayBuffer);
        }

        for (const item of pagesToExport) {
          const sourceDoc = loadedSourceDocs[item.docId];
          const [copiedPage] = await outputPdf.copyPages(sourceDoc, [item.pageIndex]);

          if (item.rotation) {
            const currentRot = copiedPage.getRotation().angle;
            copiedPage.setRotation(degrees((currentRot + item.rotation) % 360));
          }

          const { width: pageW, height: pageH } = copiedPage.getSize();

          // Incrustation des annotations de la page
          if (item.annotations && item.annotations.length > 0) {
            for (const ann of item.annotations) {
              if (ann.type === 'text') {
                copiedPage.drawText(ann.text, {
                  x: ann.x * pageW,
                  y: pageH - (ann.y * pageH) - (ann.fontSize || 16),
                  size: ann.fontSize || 16,
                  color: hexToPdfRgb(ann.color || '#000000')
                });
              } 
              else if (ann.type === 'draw' || ann.type === 'highlight') {
                const points = ann.points;
                const strokeColor = hexToPdfRgb(ann.color);
                const opacity = ann.type === 'highlight' ? 0.35 : 1.0;
                const thickness = ann.type === 'highlight' ? (ann.width || 12) : (ann.width || 3);

                for (let i = 0; i < points.length - 1; i++) {
                  copiedPage.drawLine({
                    start: { x: points[i].x * pageW, y: pageH - (points[i].y * pageH) },
                    end: { x: points[i + 1].x * pageW, y: pageH - (points[i + 1].y * pageH) },
                    thickness: thickness,
                    color: strokeColor,
                    opacity: opacity
                  });
                }
              } 
              else if (ann.type === 'signature') {
                const imgBytes = await fetch(ann.dataUrl).then(res => res.arrayBuffer());
                const embeddedImg = await outputPdf.embedPng(imgBytes);
                const sigW = (ann.w || 0.25) * pageW;
                const sigH = (ann.h || 0.12) * pageH;

                copiedPage.drawImage(embeddedImg, {
                  x: ann.x * pageW,
                  y: pageH - (ann.y * pageH) - sigH,
                  width: sigW,
                  height: sigH
                });
              }
            }
          }

          outputPdf.addPage(copiedPage);
        }

        const pdfBytes = await outputPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `pdf_annotated_${Date.now()}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Erreur lors de l'exportation du PDF :", err);
      } finally {
        this.isLoading = false;
      }
    },
    addAnnotationToCurrentPage(annotation) {
      if (this.currentPageData) {
        if (!this.currentPageData.annotations) {
          this.currentPageData.annotations = [];
        }
        this.currentPageData.annotations.push({
          id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          ...annotation
        });
      }
    },
    updateAnnotation(updatedAnno) {
      if (!this.currentPageData?.annotations) return;
      const index = this.currentPageData.annotations.findIndex(a => a.id === updatedAnno.id);
      if (index !== -1) {
        this.currentPageData.annotations[index] = { ...updatedAnno };
      }
    },
    removeAnnotation(id) {
      if (!this.currentPageData?.annotations) return;
      this.currentPageData.annotations = this.currentPageData.annotations.filter(
        a => a.id !== id
      );
    },
    setAnnotationColor(color) {
      this.annotationColor = color;
    },
    setStrokeWidth(width) {
      console.log('ststrocwidth')
      this.strokeWidth = width;
    },
    setZoomLevel(zoom) {
      this.zoomLevel = zoom;
    },
    zoomIn() {
      this.setZoomLevel(Math.min(3.0, this.zoomLevel + 0.15));
    },
    zoomOut() {
      this.setZoomLevel(Math.max(0.4, this.zoomLevel - 0.15));
    }
  },
  
});