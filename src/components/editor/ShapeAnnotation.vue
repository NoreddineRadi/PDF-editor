<template>
  <TransformBox
    :annotation="annotation"
    :page-width="pageWidth"
    :page-height="pageHeight"
    :is-selected="isSelected"
    :pass-through="annotation.type === 'shape'"
    :lock-aspect="annotation.type === 'symbol'"
    :min-width="8"
    :min-height="8"
    @select="$emit('select', annotation.id)"
    @update="(patch) => $emit('update', patch)"
    @delete="$emit('delete', annotation.id)"
  >
    <ShapeGraphic :annotation="annotation" :stroke-px="strokePx" :interactive="annotation.type === 'shape'" />
    <!-- Symboles : toute la boîte est cliquable (petits éléments) -->
    <div v-if="annotation.type === 'symbol'" class="symbol-hit"></div>
  </TransformBox>
</template>

<script>
import { mapState } from "pinia";
import { usePdfStore } from "@/stores/pdfStore";
import TransformBox from "./TransformBox.vue";
import ShapeGraphic from "./ShapeGraphic.vue";

// Formes (carré, rectangle, cercle, triangle) et symboles (cases, radios, coche, puce)
export default {
  name: "ShapeAnnotation",
  components: { TransformBox, ShapeGraphic },
  props: {
    annotation: { type: Object, required: true },
    pageWidth: { type: Number, required: true },
    pageHeight: { type: Number, required: true },
    isSelected: { type: Boolean, default: false },
  },
  emits: ["update", "delete", "select"],
  computed: {
    ...mapState(usePdfStore, ["zoomLevel"]),
    // Épaisseur stockée en points PDF ; affichée en px (suit le zoom)
    strokePx() {
      return (this.annotation.strokeWidth || 2) * this.zoomLevel;
    },
  },
};
</script>

<style scoped>
.symbol-hit {
  position: absolute;
  inset: 0;
  cursor: pointer;
}
</style>
