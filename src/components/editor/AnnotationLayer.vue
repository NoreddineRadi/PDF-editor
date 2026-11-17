<template>
  <div
    ref="layerRef"
    class="annotation-layer"
    :class="layerClasses"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @click="onLayerClick"
  >
    <!-- Tous les éléments ajoutés (ordre du tableau = ordre d'empilement) -->
    <component
      :is="COMPONENTS[anno.type]"
      v-for="anno in pageAnnotations"
      :key="anno.id"
      :annotation="anno"
      :page-width="effectiveWidth"
      :page-height="effectiveHeight"
      :is-selected="selectedAnnotationId === anno.id"
      @select="selectAnnotation(anno.id)"
      @update="(patch) => updateAnnotation({ ...patch, id: anno.id })"
      @delete="removeAnnotation(anno.id)"
    />

    <!-- Aperçu en direct : trait en cours, rectangle de masque -->
    <svg class="live-layer" :viewBox="`0 0 ${effectiveWidth} ${effectiveHeight}`" preserveAspectRatio="none">
      <path
        v-if="livePath"
        :d="livePath"
        :stroke="liveStroke.color"
        :stroke-width="liveStroke.width"
        :opacity="liveStroke.opacity"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <rect
        v-if="rubberRect"
        :x="rubberRect.x"
        :y="rubberRect.y"
        :width="rubberRect.w"
        :height="rubberRect.h"
        fill="rgba(37, 99, 235, 0.15)"
        stroke="#2563eb"
        stroke-width="1.5"
        stroke-dasharray="5 4"
      />
    </svg>
  </div>
</template>

<script>
import { mapState, mapActions } from "pinia";
import { usePdfStore } from "@/stores/pdfStore";
import TextAnnotationOverlay from "./TextAnnotationOverlay.vue";
import SignatureAnnotationOverlay from "./SignatureAnnotationOverlay.vue";
import StrokeAnnotation from "./StrokeAnnotation.vue";
import MaskAnnotation from "./MaskAnnotation.vue";
import { buildStrokeAnnotation, hitTest, pointsToPath, sampleBackground } from "@/utils/annotationGeometry";

// Type d'annotation -> composant d'affichage (ajouter un type = ajouter une ligne ici)
const COMPONENTS = {
  text: "TextAnnotationOverlay",
  signature: "SignatureAnnotationOverlay",
  drawing: "StrokeAnnotation",
  highlight: "StrokeAnnotation",
  mask: "MaskAnnotation",
};

// Outils qui captent le pointeur sur toute la page (les éléments existants deviennent "transparents")
const POINTER_TOOLS = ["draw", "highlight", "mask", "eraser"];

export default {
  name: "AnnotationLayer",
  components: { TextAnnotationOverlay, SignatureAnnotationOverlay, StrokeAnnotation, MaskAnnotation },
  props: {
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
  },
  data() {
    return {
      COMPONENTS,
      layerWidth: 0,
      layerHeight: 0,
      resizeObserver: null,

      pointerActive: false,
      livePoints: [], // crayon / surligneur en cours (px)
      rubber: null, // rectangle de masque en cours (px)
      lastErase: null,
    };
  },
  computed: {
    ...mapState(usePdfStore, [
      "activeTool",
      "currentPageData",
      "annotationColor",
      "strokeWidth",
      "zoomLevel",
      "highlightColor",
      "highlightWidth",
      "maskColor",
      "selectedAnnotationId",
    ]),

    effectiveWidth() {
      return this.width || this.layerWidth || 800;
    },
    effectiveHeight() {
      return this.height || this.layerHeight || 1130;
    },

    pageAnnotations() {
      return (this.currentPageData?.annotations || []).filter((a) => COMPONENTS[a.type]);
    },

    layerClasses() {
      return {
        "pass-through": POINTER_TOOLS.includes(this.activeTool),
        "tool-draw": this.activeTool === "draw",
        "tool-highlight": this.activeTool === "highlight",
        "tool-mask": this.activeTool === "mask",
        "tool-eraser": this.activeTool === "eraser",
        "tool-text": this.activeTool === "text",
      };
    },

    livePath() {
      if (!this.livePoints.length) return "";
      return pointsToPath(this.livePoints, 0.01);
    },
    liveStroke() {
      if (this.activeTool === "highlight") {
        return { color: this.highlightColor, width: this.highlightWidth * this.zoomLevel, opacity: 0.35 };
      }
      return { color: this.annotationColor || "#000000", width: this.strokeWidth || 3, opacity: 1 };
    },
    rubberRect() {
      if (!this.rubber) return null;
      const r = this.rubber;
      return { x: Math.min(r.x0, r.x1), y: Math.min(r.y0, r.y1), w: Math.abs(r.x1 - r.x0), h: Math.abs(r.y1 - r.y0) };
    },
  },
  watch: {
    "currentPageData.id"() {
      this.selectAnnotation(null);
    },
  },
  mounted() {
    this.updateDimensions();
    if (window.ResizeObserver && this.$refs.layerRef) {
      this.resizeObserver = new ResizeObserver(() => this.updateDimensions());
      this.resizeObserver.observe(this.$refs.layerRef);
    }
    window.addEventListener("keydown", this.onKeyDown);
  },
  beforeUnmount() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
  },
  methods: {
    ...mapActions(usePdfStore, [
      "addAnnotationToCurrentPage",
      "updateAnnotation",
      "removeAnnotation",
      "setTool",
      "selectAnnotation",
      "undo",
      "redo",
      "beginHistoryGroup",
      "endHistoryGroup",
    ]),

    updateDimensions() {
      this.$nextTick(() => {
        if (this.$refs.layerRef) {
          this.layerWidth = this.$refs.layerRef.offsetWidth;
          this.layerHeight = this.$refs.layerRef.offsetHeight;
        }
      });
    },

    /* Position du pointeur en px dans le calque */
    getPoint(e) {
      const rect = this.$refs.layerRef.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
        y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
      };
    },

    /* ---------- DESSIN / MASQUE / GOMME (pointer events) ---------- */
    onPointerDown(e) {
      if (!POINTER_TOOLS.includes(this.activeTool)) return;
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();

      this.pointerActive = true;
      this.selectAnnotation(null);
      const p = this.getPoint(e);

      if (this.activeTool === "draw") {
        this.livePoints = [p];
      } else if (this.activeTool === "highlight") {
        // Surligneur : segment droit entre le point de départ et la souris
        this.livePoints = [p, { ...p }];
      } else if (this.activeTool === "mask") {
        this.rubber = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      } else if (this.activeTool === "eraser") {
        this.beginHistoryGroup();
        this.lastErase = p;
        this.eraseAt(p);
      }

      try {
        this.$refs.layerRef.setPointerCapture(e.pointerId);
      } catch (_) {
        /* pointeur déjà relâché */
      }
    },

    onPointerMove(e) {
      if (!this.pointerActive) return;
      const p = this.getPoint(e);

      if (this.activeTool === "draw") {
        this.livePoints.push(p);
      } else if (this.activeTool === "highlight") {
        this.livePoints[1] = p;
      } else if (this.activeTool === "mask" && this.rubber) {
        this.rubber.x1 = p.x;
        this.rubber.y1 = p.y;
      } else if (this.activeTool === "eraser") {
        this.eraseSegment(this.lastErase, p);
        this.lastErase = p;
      }
    },

    onPointerUp(e) {
      if (!this.pointerActive) return;
      this.pointerActive = false;

      const tool = this.activeTool;
      if (tool === "draw") this.finishDraw();
      else if (tool === "highlight") this.finishHighlight();
      else if (tool === "mask") this.finishMask();
      else if (tool === "eraser") {
        this.endHistoryGroup();
        this.lastErase = null;
      }

      this.livePoints = [];
      this.rubber = null;
      try {
        this.$refs.layerRef.releasePointerCapture(e.pointerId);
      } catch (_) {
        /* ignoré */
      }
    },

    finishDraw() {
      if (!this.livePoints.length) return;
      this.addAnnotationToCurrentPage(
        buildStrokeAnnotation(this.livePoints, {
          pageW: this.effectiveWidth,
          pageH: this.effectiveHeight,
          zoom: this.zoomLevel,
          // Épaisseur choisie en px à l'écran -> stockée en points PDF
          strokePt: (this.strokeWidth || 3) / this.zoomLevel,
          type: "drawing",
          color: this.annotationColor || "#000000",
        })
      );
    },

    finishHighlight() {
      const [a, b] = this.livePoints;
      if (!a || !b || Math.hypot(b.x - a.x, b.y - a.y) < 3) return; // simple clic : on ignore
      this.addAnnotationToCurrentPage(
        buildStrokeAnnotation([a, b], {
          pageW: this.effectiveWidth,
          pageH: this.effectiveHeight,
          zoom: this.zoomLevel,
          strokePt: this.highlightWidth,
          type: "highlight",
          color: this.highlightColor,
        })
      );
    },

    finishMask() {
      const r = this.rubberRect;
      if (!r || r.w < 4 || r.h < 4) return;
      let color = this.maskColor;
      if (color === "auto") {
        const canvas = this.$el.parentElement?.querySelector("canvas");
        color = canvas ? sampleBackground(canvas, r.x, r.y, r.w, r.h) : "#ffffff";
      }
      this.addAnnotationToCurrentPage({
        type: "mask",
        x: (r.x / this.effectiveWidth) * 100,
        y: (r.y / this.effectiveHeight) * 100,
        width: (r.w / this.effectiveWidth) * 100,
        height: (r.h / this.effectiveHeight) * 100,
        rotation: 0,
        color,
      });
    },

    /* Gomme : supprime l'élément le plus haut sous le pointeur */
    eraseAt(p) {
      const list = this.currentPageData?.annotations || [];
      for (let i = list.length - 1; i >= 0; i--) {
        const a = list[i];
        if (!COMPONENTS[a.type]) continue;
        if (hitTest(a, p.x, p.y, this.effectiveWidth, this.effectiveHeight, this.zoomLevel)) {
          this.removeAnnotation(a.id, { history: true });
          return;
        }
      }
    },
    // Un mouvement rapide saute des pixels : on échantillonne le segment tous les 4 px
    eraseSegment(from, to) {
      if (!from) return this.eraseAt(to);
      const n = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4));
      for (let i = 1; i <= n; i++) {
        this.eraseAt({ x: from.x + ((to.x - from.x) * i) / n, y: from.y + ((to.y - from.y) * i) / n });
      }
    },

    /* ---------- CLICS ---------- */
    onLayerClick(e) {
      if (this.activeTool === "text") {
        this.createNewTextAnnotation(e);
      } else if (e.target === this.$refs.layerRef || e.target.classList?.contains("live-layer")) {
        this.selectAnnotation(null);
      }
    },

    createNewTextAnnotation(e) {
      const rect = this.$refs.layerRef.getBoundingClientRect();
      const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

      this.addAnnotationToCurrentPage(
        {
          type: "text",
          x: Math.max(0, Math.min(xPercent, 70)),
          y: Math.max(0, Math.min(yPercent, 94)),
          width: 25,
          height: 3,
          rotation: 0,
          text: "",
          fontSize: 16,
          color: this.annotationColor || "#000000",
        },
        { select: true }
      );
      this.setTool("select");
      // setTool vide la sélection pour les outils de dessin ; "select" la conserve
    },

    /* ---------- CLAVIER ---------- */
    onKeyDown(e) {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = (e.key || "").toLowerCase();

      if ((e.key === "Delete" || e.key === "Backspace") && this.selectedAnnotationId) {
        e.preventDefault();
        this.removeAnnotation(this.selectedAnnotationId);
      } else if (mod && !e.shiftKey && key === "z") {
        e.preventDefault();
        this.undo();
      } else if (mod && (key === "y" || (e.shiftKey && key === "z"))) {
        e.preventDefault();
        this.redo();
      } else if (e.key === "Escape") {
        this.selectAnnotation(null);
        if (this.activeTool !== "select") this.setTool("select");
      }
    },
  },
};
</script>

<style scoped>
.annotation-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 20;
  pointer-events: auto;
  margin: 0;
  padding: 0;
  border: none;
}

.live-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  z-index: 60;
}

/* Outils de dessin : les éléments existants ne captent plus la souris */
.annotation-layer.pass-through {
  touch-action: none;
}
.annotation-layer.pass-through :deep(.tbox-anchor),
.annotation-layer.pass-through :deep(.tbox-anchor *) {
  pointer-events: none !important;
}

.tool-draw,
.tool-highlight,
.tool-mask {
  cursor: crosshair;
}
.tool-text {
  cursor: text;
}
.tool-eraser {
  cursor: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='9' fill='rgba(239,68,68,0.15)' stroke='%23ef4444' stroke-width='2'/%3E%3C/svg%3E") 12 12, pointer;
}
</style>
