<template>
  <TransformBox
    :annotation="annotation"
    :page-width="pageWidth"
    :page-height="pageHeight"
    :is-selected="isSelected"
    :min-width="30"
    :min-height="16"
    @select="$emit('select', annotation.id)"
    @update="(patch) => $emit('update', patch)"
    @delete="$emit('delete', annotation.id)"
  >
    <img :src="annotation.dataUrl" class="annotation-image" draggable="false" alt="" />
  </TransformBox>
</template>

<script>
import TransformBox from "./TransformBox.vue";

// Rendu des éléments de type "signature" (et, au lot suivant, "image") : image ajustée dans la boîte
export default {
  name: "SignatureAnnotationOverlay",
  components: { TransformBox },
  props: {
    annotation: { type: Object, required: true },
    pageWidth: { type: Number, required: true },
    pageHeight: { type: Number, required: true },
    isSelected: { type: Boolean, default: false },
  },
  emits: ["update", "delete", "select"],
};
</script>

<style scoped>
.annotation-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain; /* même ajustement que l'export */
  pointer-events: none;
  user-select: none;
}
</style>
