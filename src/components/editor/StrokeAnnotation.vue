<template>
  <TransformBox
    :annotation="annotation"
    :page-width="pageWidth"
    :page-height="pageHeight"
    :is-selected="isSelected"
    :pass-through="true"
    :min-width="8"
    :min-height="8"
    @select="$emit('select', annotation.id)"
    @update="(patch) => $emit('update', patch)"
    @delete="$emit('delete', annotation.id)"
  >
    <!-- Les points sont relatifs à la boîte (0..1) : redimensionnement et rotation sont gérés par la boîte -->
    <svg class="stroke-svg" viewBox="0 0 1 1" preserveAspectRatio="none">
      <!-- Zone de clic élargie (invisible) pour attraper facilement un trait fin -->
      <path
        :d="path"
        class="stroke-hit"
        stroke="transparent"
        :stroke-width="hitWidth"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
      <path
        :d="path"
        :stroke="annotation.color || '#000000'"
        :stroke-width="visibleWidth"
        :opacity="annotation.type === 'highlight' ? 0.35 : 1"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
        pointer-events="none"
      />
    </svg>
  </TransformBox>
</template>

<script>
import { mapState } from "pinia";
import { usePdfStore } from "@/stores/pdfStore";
import { pointsToPath } from "@/utils/annotationGeometry";
import TransformBox from "./TransformBox.vue";

// Crayon et surligneur
export default {
  name: "StrokeAnnotation",
  components: { TransformBox },
  props: {
    annotation: { type: Object, required: true },
    pageWidth: { type: Number, required: true },
    pageHeight: { type: Number, required: true },
    isSelected: { type: Boolean, default: false },
  },
  emits: ["update", "delete", "select"],
  computed: {
    ...mapState(usePdfStore, ["zoomLevel"]),
    path() {
      return pointsToPath(this.annotation.points, 0.0001);
    },
    // Épaisseur stockée en points PDF ; affichée en px (suit le zoom). Non-scaling-stroke : reste constante quand on redimensionne.
    visibleWidth() {
      return (this.annotation.strokeWidth || 3) * this.zoomLevel;
    },
    hitWidth() {
      return Math.max(this.visibleWidth, 14);
    },
  },
};
</script>

<style scoped>
.stroke-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.stroke-hit {
  pointer-events: stroke;
  cursor: pointer;
}
</style>
