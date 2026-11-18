<template>
  <TransformBox
    :annotation="annotation"
    :page-width="pageWidth"
    :page-height="pageHeight"
    :is-selected="isSelected"
    :min-width="8"
    :min-height="8"
    @select="$emit('select', annotation.id)"
    @update="(patch) => $emit('update', patch)"
    @delete="$emit('delete', annotation.id)"
  >
    <div class="mask-fill" :style="{ backgroundColor: annotation.color || '#ffffff' }"></div>
  </TransformBox>
</template>

<script>
import TransformBox from "./TransformBox.vue";

// Masque : rectangle plein qui cache le contenu de la page (masquage visuel)
export default {
  name: "MaskAnnotation",
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
.mask-fill {
  width: 100%;
  height: 100%;
}
</style>
