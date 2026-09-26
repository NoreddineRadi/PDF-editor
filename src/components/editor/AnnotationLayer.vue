<template>
  <div ref="layerRef" class="annotation-layer" :class="{ 'is-draw-tool': activeTool === 'draw' || activeTool === 'highlight' }" @click="onLayerClick">
    <!-- CALQUE SVG POUR LE DESSIN À LA MAIN LEVÉE -->
    <svg
      class="drawing-svg-layer"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <!-- 1. Dessins enregistrés -->
      <g
        v-for="anno in pageDrawingAnnotations"
        :key="anno.id"
        class="drawing-group"
        :class="{ 'is-selected': selectedAnnotationId === anno.id }"
        @click.stop="selectDrawing(anno.id)"
      >
        <!-- Zone de clic élargie (invisible) pour attraper facilement le trait -->
        <path :d="pointsToSvgPath(anno.points)" stroke="transparent" stroke-width="20" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Le vrai trait visible -->
        <path
          :d="pointsToSvgPath(anno.points)"
          :stroke="anno.color || '#000000'"
          :stroke-width="anno.strokeWidth || 3"
          :opacity="anno.type === 'highlight' ? 0.35 : 1"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </g>

      <!-- 2. Trait en cours de dessin -->
      <path
        v-if="currentPath.length > 0"
        :d="pointsToSvgPath(currentPath)"
        :stroke="activeTool === 'highlight' ? '#FFFF00' : annotationColor || '#000000'"
        :stroke-width="activeTool === 'highlight' ? 20 : strokeWidth || 3"
        :opacity="activeTool === 'highlight' ? 0.35 : 1"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>

    <!-- Bouton de suppression flottant pour le dessin sélectionné -->
    <div v-if="selectedDrawingBounds" class="drawing-toolbar" :style="selectedDrawingToolbarStyle">
      <button class="tool-btn delete-btn" @click.stop="deleteSelectedDrawing" title="Supprimer le dessin">✕</button>
    </div>

    <!-- OVERLAYS DES ZONES DE TEXTE -->
    <TextAnnotationOverlay
      v-for="anno in pageTextAnnotations"
      :key="anno.id"
      :annotation="anno"
      :page-width="effectiveWidth"
      :page-height="effectiveHeight"
      :is-selected="selectedAnnotationId === anno.id"
      @select="selectAnnotation"
      @update="updateAnnotation"
      @delete="deleteAnnotation"
    />

    <SignatureAnnotationOverlay
      v-for="anno in pageSignatureAnnotations"
      :key="anno.id"
      :annotation="anno"
      :page-width="effectiveWidth"
      :page-height="effectiveHeight"
      :is-selected="selectedAnnotationId === anno.id"
      @select="selectAnnotation"
      @update="updateAnnotation"
      @delete="deleteAnnotation"
    />
  </div>
</template>

<script>
import { mapState, mapActions } from "pinia";
import { usePdfStore } from "@/stores/pdfStore";
import TextAnnotationOverlay from "./TextAnnotationOverlay.vue";
import SignatureAnnotationOverlay from "./SignatureAnnotationOverlay.vue";

export default {
  name: "AnnotationLayer",
  components: { TextAnnotationOverlay, SignatureAnnotationOverlay },
  props: {
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
  },
  data() {
    return {
      selectedAnnotationId: null,
      layerWidth: 0,
      layerHeight: 0,
      resizeObserver: null,

      // État local pour le dessin en cours
      isDrawing: false,
      currentPath: [],
    };
  },
  computed: {
    ...mapState(usePdfStore, ["activeTool", "currentPageData", "annotationColor", "strokeWidth", "zoomLevel"]),

    effectiveWidth() {
      return this.width || this.layerWidth || this.$refs.layerRef?.clientWidth || 800;
    },
    effectiveHeight() {
      return this.height || this.layerHeight || this.$refs.layerRef?.clientHeight || 1130;
    },

    pageTextAnnotations() {
      const list = this.currentPageData?.annotations || [];
      return list.filter((anno) => anno.type === "text");
    },

    pageDrawingAnnotations() {
      const list = this.currentPageData?.annotations || [];
      return list.filter((anno) => anno.type === "drawing" || anno.type === "highlight");
    },

    // Calcule la position de la corbeille au-dessus du dessin sélectionné
    selectedDrawingBounds() {
      if (!this.selectedAnnotationId) return null;
      const drawing = this.pageDrawingAnnotations.find((a) => a.id === this.selectedAnnotationId);
      if (!drawing || !drawing.points || !drawing.points.length) return null;

      let minX = Infinity,
        minY = Infinity;
      for (const p of drawing.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
      }
      return { minX, minY };
    },

    selectedDrawingToolbarStyle() {
      if (!this.selectedDrawingBounds) return {};
      const { minX, minY } = this.selectedDrawingBounds;
      const left = (minX / 1000) * this.effectiveWidth;
      const top = Math.max(0, (minY / 1000) * this.effectiveHeight - 34);

      return {
        left: `${left}px`,
        top: `${top}px`,
      };
    },
    pageSignatureAnnotations() {
      const list = this.currentPageData?.annotations || [];
      return list.filter((anno) => anno.type === "signature");
    },
  },
  watch: {
    currentPageData: { deep: true, handler: "updateDimensions" },
    zoomLevel: "updateDimensions",
  },
  mounted() {
    this.updateDimensions();

    if (window.ResizeObserver && this.$refs.layerRef) {
      this.resizeObserver = new ResizeObserver(() => this.updateDimensions());
      this.resizeObserver.observe(this.$refs.layerRef);
    }
  },
  beforeUnmount() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
  },
  methods: {
    ...mapActions(usePdfStore, ["addAnnotationToCurrentPage", "updateAnnotation", "removeAnnotation", "setTool"]),

    updateDimensions() {
      this.$nextTick(() => {
        if (this.$refs.layerRef) {
          this.layerWidth = this.$refs.layerRef.offsetWidth;
          this.layerHeight = this.$refs.layerRef.offsetHeight;
        }
      });
    },

    // Converts array of [{x, y}] into an SVG path string "M x y L x y ..."
    // Algorithme de lissage fluide pour écriture manuscrite et signatures
    pointsToSvgPath(points) {
      if (!points || points.length === 0) return "";

      // Point unique (un simple point/point d'i)
      if (points.length === 1) {
        return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
      }

      // Deux points seulement
      if (points.length === 2) {
        return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
      }

      // Lissage avec courbes de Bézier quadratiques aux points médians
      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        path += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
      }

      // Dernier segment
      const lastIndex = points.length - 1;
      path += ` Q ${points[lastIndex - 1].x} ${points[lastIndex - 1].y}, ${points[lastIndex].x} ${points[lastIndex].y}`;

      return path;
    },

    // Convert mouse/pointer position to normalized 0-1000 grid
    getCoordinates(e) {
      if (!this.$refs.layerRef) return { x: 0, y: 0 };
      const rect = this.$refs.layerRef.getBoundingClientRect();
      const x = Math.max(0, Math.min(1000, ((e.clientX - rect.left) / rect.width) * 1000));
      const y = Math.max(0, Math.min(1000, ((e.clientY - rect.top) / rect.height) * 1000));
      return {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
      };
    },

    /* GESTION DU DESSIN (POINTER EVENTS) */
    onPointerDown(e) {
      if (this.activeTool !== "draw" && this.activeTool !== "highlight") return;

      this.isDrawing = true;
      this.selectedAnnotationId = null;
      const coord = this.getCoordinates(e);
      if (this.activeTool === "highlight") {
        // 💡 Pour le highlight : on fixe un point de départ et on duplique pour l'arrivée en temps réel
        this.currentPath = [coord, { ...coord }];
      } else {
        // Pour le dessin libre normal : on accumule les points
        this.currentPath = [coord];
      }

      // Capture le pointeur pour ne pas perdre le tracé si le curseur sort de la fenêtre
      if (e.target && typeof e.target.setPointerCapture === "function") {
        e.target.setPointerCapture(e.pointerId);
      }
    },

    onPointerMove(e) {
      if (!this.isDrawing || (this.activeTool !== "draw" && this.activeTool !== "highlight")) return;

      const coord = this.getCoordinates(e);
      if (this.activeTool === "highlight") {
        // 💡 Pour le highlight : on met juste à jour le 2e point (le point d'arrivée suit la souris en ligne droite)
        this.currentPath[1] = coord;
      } else {
        // Pour le dessin libre normal
        this.currentPath.push(coord);
      }
    },

    onPointerUp(e) {
      if (!this.isDrawing) return;

      this.isDrawing = false;

      if (this.currentPath.length > 0) {
        const isHighlight = this.activeTool === "highlight";
        const newAnno = {
          type: isHighlight ? "highlight" : "drawing",
          points: [...this.currentPath],
          color: isHighlight ? "#FFFF00" : this.annotationColor || "#000000",
          strokeWidth: isHighlight ? 20 : this.strokeWidth || 3,
        };

        // Sauvegarde dans le store Pinia
        this.addAnnotationToCurrentPage(newAnno);
      }

      this.currentPath = [];

      if (e.target && typeof e.target.releasePointerCapture === "function") {
        try {
          e.target.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    },

    /* SÉLECTION ET CLICS */
    onLayerClick(e) {
      if (this.activeTool === "text") {
        this.createNewTextAnnotation(e);
      } else if (e.target === this.$refs.layerRef || e.target.classList?.contains("drawing-svg-layer")) {
        this.selectedAnnotationId = null;
      }
    },

    selectDrawing(id) {
      if (this.activeTool === "select") {
        this.selectedAnnotationId = id;
      }
    },

    deleteSelectedDrawing() {
      if (this.selectedAnnotationId) {
        this.removeAnnotation(this.selectedAnnotationId);
        this.selectedAnnotationId = null;
      }
    },

    createNewTextAnnotation(e) {
      const rect = this.$refs.layerRef.getBoundingClientRect();
      const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

      const newAnno = {
        type: "text",
        x: Math.max(0, Math.min(xPercent, 70)),
        y: Math.max(0, Math.min(yPercent, 90)),
        width: 25,
        height: 2,
        text: "",
        fontSize: 16,
        color: this.annotationColor || "#000000",
      };

      this.addAnnotationToCurrentPage(newAnno);

      this.$nextTick(() => {
        const list = this.currentPageData?.annotations || [];
        const createdAnno = list[list.length - 1];
        if (createdAnno) {
          this.selectedAnnotationId = createdAnno.id;
        }
      });

      this.setTool("select");
    },

    selectAnnotation(id) {
      this.selectedAnnotationId = id;
    },

    deleteAnnotation(id) {
      this.removeAnnotation(id);
      this.selectedAnnotationId = null;
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

.annotation-layer.is-draw-tool {
  cursor: crosshair;
}

.drawing-svg-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  pointer-events: auto;
  touch-action: none;
}

.drawing-group {
  cursor: pointer;
}

/* Effet surbrillance bleu si le dessin est sélectionné */
.drawing-group.is-selected path:nth-child(2) {
  stroke: #2563eb !important;
  filter: drop-shadow(0 0 4px rgba(37, 99, 235, 0.6));
}

.drawing-toolbar {
  position: absolute;
  z-index: 40;
  background-color: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 2px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.tool-btn {
  background: transparent;
  border: none;
  color: #f8fafc;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: bold;
}

.delete-btn {
  color: #f87171;
}
.delete-btn:hover {
  background-color: rgba(239, 68, 68, 0.25);
}
</style>
