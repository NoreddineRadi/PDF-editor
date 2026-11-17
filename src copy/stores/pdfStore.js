import { defineStore } from "pinia";
import { markRaw } from "vue";
import { PDFDocument, StandardFonts, LineCapStyle, degrees, rgb } from "pdf-lib";
import pdfReaderService from "@/services/pdfReader";

// Convertisseur Hex (#RRGGBB) vers RGB (0 à 1) pour pdf-lib
function hexToPdfRgb(hexColor) {
  const hex = (hexColor || "#000000").replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(hex.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(hex.substring(4, 6), 16) / 255 || 0;
  return rgb(r, g, b);
}

const normalizeAngle = (a) => ((Math.round(a / 90) * 90) % 360 + 360) % 360;

/**
 * Convertit une position exprimée en fractions (0..1) depuis le coin haut-gauche de la page
 * AFFICHÉE (rotation comprise) vers l'espace utilisateur PDF (origine en bas à gauche,
 * avant application de /Rotate). W et H sont les dimensions non pivotées de la page.
 */
function viewToUser(fx, fy, W, H, R) {
  switch (R) {
    case 90:
      return { x: fy * W, y: fx * H };
    case 180:
      return { x: (1 - fx) * W, y: fy * H };
    case 270:
      return { x: (1 - fy) * W, y: (1 - fx) * H };
    default:
      return { x: fx * W, y: (1 - fy) * H };
  }
}

// Helvetica (WinAnsi) ne sait pas encoder tous les caractères : on remplace ceux qui ne passent pas
function safeText(font, text) {
  let out = "";
  for (const ch of String(text ?? "")) {
    if (ch === "\n") {
      out += ch;
      continue;
    }
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

export const usePdfStore = defineStore("pdf", {
  state: () => ({
    documents: {},
    pagesOrder: [], // Array<{ id, docId, pageIndex, rotation, selected, annotations: [] }>
    currentPageIndex: 0,
    zoomLevel: 1.0,
    isLoading: false,

    // Outils d'annotation
    activeTool: "select", // 'select' | 'text' | 'draw' | 'highlight'
    annotationColor: "#000000",
    strokeWidth: 3,
    fontSize: 16,
  }),

  getters: {
    hasDocument: (state) => state.pagesOrder.length > 0,
    pageCount: (state) => state.pagesOrder.length,
    currentPage: (state) => state.currentPageIndex + 1,
    formattedZoom: (state) => `${Math.round(state.zoomLevel * 100)}%`,
    currentPageData: (state) => state.pagesOrder[state.currentPageIndex] || null,
    selectedPages: (state) => state.pagesOrder.filter((p) => p.selected),
    selectedCount: (state) => state.pagesOrder.filter((p) => p.selected).length,
    hasSelection: (state) => state.pagesOrder.some((p) => p.selected),
  },

  actions: {
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
          this.documents[docId] = markRaw({ id: docId, name: file.name, pdfJsDoc, arrayBuffer });

          for (let i = 0; i < pdfJsDoc.numPages; i++) {
            this.pagesOrder.push({
              id: `page_${docId}_${i}_${Math.random().toString(36).substring(2, 7)}`,
              docId,
              pageIndex: i,
              rotation: 0,
              selected: false,
              annotations: [], // Annotations de la page
            });
          }
        }
      } catch (err) {
        console.error("Erreur lors de l'ajout des fichiers PDF :", err);
        alert("Impossible de lire ce PDF : " + (err?.message || err));
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
    setStrokeWidth(width) {
      this.strokeWidth = width;
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
    rotatePage(index) {
      if (this.pagesOrder[index]) this.pagesOrder[index].rotation = (this.pagesOrder[index].rotation + 90) % 360;
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
      if (this.pagesOrder[index]) this.pagesOrder[index].selected = !this.pagesOrder[index].selected;
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
    },

    async exportPdf(onlySelected = false) {
      if (!this.hasDocument) return;
      const pagesToExport = onlySelected ? this.selectedPages : this.pagesOrder;
      if (pagesToExport.length === 0) return;

      this.isLoading = true;

      try {
        const outputPdf = await PDFDocument.create();
        const font = await outputPdf.embedFont(StandardFonts.Helvetica);
        const loadedSourceDocs = {};
        const imageCache = new Map();

        for (const item of pagesToExport) {
          if (!loadedSourceDocs[item.docId]) {
            loadedSourceDocs[item.docId] = await PDFDocument.load(this.documents[item.docId].arrayBuffer);
          }
          const sourceDoc = loadedSourceDocs[item.docId];
          const [copiedPage] = await outputPdf.copyPages(sourceDoc, [item.pageIndex]);

          const nativeRotation = normalizeAngle(copiedPage.getRotation().angle);
          const R = normalizeAngle(nativeRotation + (item.rotation || 0));
          if (R !== nativeRotation) copiedPage.setRotation(degrees(R));

          const page = outputPdf.addPage(copiedPage);

          // Dimensions NON pivotées de la page (espace utilisateur) et dimensions affichées
          const { width: W, height: H } = page.getSize();
          const vw = R % 180 === 0 ? W : H;
          const vh = R % 180 === 0 ? H : W;

          for (const ann of item.annotations || []) {
            if (ann.type === "text") {
              if (!ann.text || !ann.text.trim()) continue;
              const size = ann.fontSize || 16; // en points PDF
              const boxW = ((ann.width || 25) / 100) * vw;
              // Ligne de base ≈ haut de la boîte + padding + 1 em
              const p = viewToUser(
                (ann.x / 100) + 5 / vw,
                (ann.y / 100) + (size + 3) / vh,
                W,
                H,
                R
              );
              page.drawText(safeText(font, ann.text), {
                x: p.x,
                y: p.y,
                size,
                font,
                color: hexToPdfRgb(ann.color),
                lineHeight: size * 1.3,
                maxWidth: Math.max(20, boxW - 10),
                rotate: degrees(R),
              });
            } else if (ann.type === "drawing" || ann.type === "highlight") {
              const points = ann.points;
              if (!points || points.length < 1) continue;
              const color = hexToPdfRgb(ann.color);
              const opacity = ann.type === "highlight" ? 0.35 : 1.0;
              const thickness = ann.strokeWidth || (ann.type === "highlight" ? 20 : 3);
              // Les points sont sur une grille normalisée 0..1000
              const toUser = (pt) => viewToUser(pt.x / 1000, pt.y / 1000, W, H, R);

              if (points.length === 1) {
                const a = toUser(points[0]);
                page.drawLine({ start: a, end: a, thickness, color, opacity, lineCap: LineCapStyle.Round });
                continue;
              }
              for (let i = 0; i < points.length - 1; i++) {
                page.drawLine({
                  start: toUser(points[i]),
                  end: toUser(points[i + 1]),
                  thickness,
                  color,
                  opacity,
                  lineCap: LineCapStyle.Round,
                });
              }
            } else if (ann.type === "signature" && ann.dataUrl) {
              let img = imageCache.get(ann.dataUrl);
              if (!img) {
                const imgBytes = await fetch(ann.dataUrl).then((res) => res.arrayBuffer());
                img = await outputPdf.embedPng(imgBytes);
                imageCache.set(ann.dataUrl, img);
              }

              // Même logique que l'affichage (object-fit: contain, centré dans la boîte)
              const boxW = ((ann.width || 25) / 100) * vw;
              const boxH = ((ann.height || 10) / 100) * vh;
              const ratio = Math.min(boxW / img.width, boxH / img.height);
              const dw = img.width * ratio;
              const dh = img.height * ratio;
              const offX = (boxW - dw) / 2;
              const offY = (boxH - dh) / 2;

              // Coin bas-gauche visuel de l'image
              const p = viewToUser((ann.x / 100) + offX / vw, (ann.y / 100) + (offY + dh) / vh, W, H, R);
              page.drawImage(img, {
                x: p.x,
                y: p.y,
                width: dw,
                height: dh,
                rotate: degrees(R),
              });
            }
          }
        }

        const pdfBytes = await outputPdf.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `pdf_annotated_${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch (err) {
        console.error("Erreur lors de l'exportation du PDF :", err);
        alert("Erreur lors de l'exportation : " + err.message);
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
          ...annotation,
        });
      }
    },
    updateAnnotation(updatedAnno) {
      if (!this.currentPageData?.annotations) return;
      const index = this.currentPageData.annotations.findIndex((a) => a.id === updatedAnno.id);
      if (index !== -1) {
        this.currentPageData.annotations[index] = { ...updatedAnno };
      }
    },
    removeAnnotation(id) {
      if (!this.currentPageData?.annotations) return;
      this.currentPageData.annotations = this.currentPageData.annotations.filter((a) => a.id !== id);
    },

    setZoomLevel(zoom) {
      this.zoomLevel = zoom;
    },
    zoomIn() {
      this.setZoomLevel(Math.min(3.0, Math.round((this.zoomLevel + 0.15) * 100) / 100));
    },
    zoomOut() {
      this.setZoomLevel(Math.max(0.4, Math.round((this.zoomLevel - 0.15) * 100) / 100));
    },
  },
});
