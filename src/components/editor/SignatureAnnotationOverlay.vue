<template>
  <TransformBox
    :annotation="annotation"
    :page-width="pageWidth"
    :page-height="pageHeight"
    :is-selected="isSelected"
    :lock-aspect="isImage"
    :corners-only="isImage"
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

// Rendu des éléments "signature" et "image" : image ajustée dans la boîte (mêmes contrôles que le texte)
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
  computed: {
    isImage() {
      return this.annotation.type === "image";
    },
  },
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
