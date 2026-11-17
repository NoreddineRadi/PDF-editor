<template>
  <TransformBox
    ref="tbox"
    :annotation="annotation"
    :page-width="pageWidth"
    :page-height="pageHeight"
    :is-selected="isSelected"
    :drag-from-body="false"
    :min-width="40"
    :min-height="22"
    @select="$emit('select', annotation.id)"
    @update="(patch) => $emit('update', patch)"
    @delete="$emit('delete', annotation.id)"
  >
    <textarea
      ref="textareaRef"
      v-model="localText"
      class="text-input"
      :style="textStyle"
      placeholder="Saisissez votre texte..."
      spellcheck="false"
      @input="onTextChange"
      @focus="$emit('select', annotation.id)"
    ></textarea>

    <template #toolbar>
      <button class="tbox-btn" title="Réduire la taille" @click.stop="changeFontSize(-2)">−</button>
      <span class="tbox-label">{{ annotation.fontSize || 16 }} pt</span>
      <button class="tbox-btn" title="Agrandir la taille" @click.stop="changeFontSize(2)">+</button>
      <span class="tbox-sep"></span>
      <input
        type="color"
        class="tbox-color"
        title="Couleur du texte"
        :value="annotation.color || '#000000'"
        @input="(e) => $emit('update', { color: e.target.value })"
        @click.stop
      />
      <span class="tbox-sep"></span>
      <button class="tbox-btn tbox-drag" title="Déplacer" @pointerdown.stop.prevent="$refs.tbox.startDrag($event)">✥</button>
    </template>
  </TransformBox>
</template>

<script>
import { mapState } from "pinia";
import { usePdfStore } from "@/stores/pdfStore";
import TransformBox from "./TransformBox.vue";

export default {
  name: "TextAnnotationOverlay",
  components: { TransformBox },
  props: {
    annotation: { type: Object, required: true },
    pageWidth: { type: Number, required: true },
    pageHeight: { type: Number, required: true },
    isSelected: { type: Boolean, default: false },
  },
  emits: ["update", "delete", "select"],
  data() {
    return { localText: this.annotation.text || "" };
  },
  computed: {
    ...mapState(usePdfStore, ["zoomLevel"]),

    // fontSize est stocké en points PDF ; l'affichage (police ET marges) suit le zoom comme la page
    textStyle() {
      const z = this.zoomLevel;
      return {
        fontSize: `${(this.annotation.fontSize || 16) * z}px`,
        color: this.annotation.color || "#000000",
        padding: `${4 * z}px ${6 * z}px`,
      };
    },
  },
  watch: {
    // Annuler / rétablir modifient le texte depuis l'extérieur
    "annotation.text"(value) {
      if ((value || "") !== this.localText) this.localText = value || "";
    },
    isSelected(selected) {
      if (selected) this.$nextTick(() => this.$refs.textareaRef?.focus());
    },
  },
  mounted() {
    if (this.isSelected) this.$nextTick(() => this.$refs.textareaRef?.focus());
  },
  methods: {
    onTextChange() {
      this.$emit("update", { text: this.localText });
    },
    changeFontSize(delta) {
      const next = Math.max(6, (this.annotation.fontSize || 16) + delta);
      this.$emit("update", { fontSize: next });
    },
  },
};
</script>

<style scoped>
/* Helvetica/Arial : mêmes métriques que la police utilisée à l'export, pour que les retours à la ligne concordent */
.text-input {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  resize: none;
  font-family: Helvetica, Arial, "Liberation Sans", sans-serif;
  line-height: 1.3;
  box-sizing: border-box;
  overflow: hidden;
  user-select: text;
  cursor: text;
}
</style>
