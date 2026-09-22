<template>
  <div 
    class="signature-annotation-box"
    :class="{ 'is-selected': isSelected }"
    :style="boxStyle"
    @click.stop="selectSelf"
  >
    <!-- Barre d'outils flottante -->
    <div v-if="isSelected" class="annotation-toolbar">
      <button class="tool-btn drag-handle" @pointerdown.stop="startDrag" title="Déplacer">✥</button>
      <button class="tool-btn delete-btn" @click.stop="removeSelf" title="Supprimer">✕</button>
    </div>

    <!-- Image de la signature -->
    <img :src="annotation.dataUrl" class="signature-image" draggable="false" />

    <!-- Poignée de redimensionnement (Coin bas-droit) -->
    <div 
      v-if="isSelected" 
      class="resize-handle bottom-right"
      @pointerdown.stop="startResize"
    ></div>
  </div>
</template>

<script>
export default {
  name: 'SignatureAnnotationOverlay',
  props: {
    annotation: { type: Object, required: true },
    pageWidth: { type: Number, required: true },
    pageHeight: { type: Number, required: true },
    isSelected: { type: Boolean, default: false }
  },
  emits: ['update', 'delete', 'select'],
  data() {
    return {
      localX: this.annotation.x,
      localY: this.annotation.y,
      localW: this.annotation.width,
      localH: this.annotation.height,
      isDragging: false,
      isResizing: false,
      dragStart: { x: 0, y: 0 },
      initialPos: { x: 0, y: 0, w: 0, h: 0 }
    };
  },
  computed: {
    boxStyle() {
      const w = Math.max((this.localW / 100) * this.pageWidth, 80);
      const h = Math.max((this.localH / 100) * this.pageHeight, 30);
      const left = (this.localX / 100) * this.pageWidth;
      const top = (this.localY / 100) * this.pageHeight;

      return {
        left: `${left}px`,
        top: `${top}px`,
        width: `${w}px`,
        height: `${h}px`
      };
    }
  },
  watch: {
    annotation: {
      deep: true,
      handler(newVal) {
        if (!this.isDragging && !this.isResizing) {
          this.localX = newVal.x;
          this.localY = newVal.y;
          this.localW = newVal.width;
          this.localH = newVal.height;
        }
      }
    }
  },
  methods: {
    selectSelf() {
      this.$emit('select', this.annotation.id);
    },
    removeSelf() {
      this.$emit('delete', this.annotation.id);
    },

    /* DRAG & DROP */
    startDrag(e) {
      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.initialPos = { x: this.localX, y: this.localY };

      window.addEventListener('pointermove', this.onDrag);
      window.addEventListener('pointerup', this.stopDrag);
    },
    onDrag(e) {
      if (!this.isDragging) return;
      const deltaX = ((e.clientX - this.dragStart.x) / this.pageWidth) * 100;
      const deltaY = ((e.clientY - this.dragStart.y) / this.pageHeight) * 100;

      this.localX = Math.max(0, Math.min(100 - this.localW, this.initialPos.x + deltaX));
      this.localY = Math.max(0, Math.min(100 - this.localH, this.initialPos.y + deltaY));
    },
    stopDrag() {
      if (this.isDragging) {
        this.isDragging = false;
        window.removeEventListener('pointermove', this.onDrag);
        window.removeEventListener('pointerup', this.stopDrag);

        this.$emit('update', { 
          ...this.annotation, 
          x: this.localX, 
          y: this.localY 
        });
      }
    },

    /* RESIZE */
    startResize(e) {
      this.isResizing = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.initialPos = { w: this.localW, h: this.localH };

      window.addEventListener('pointermove', this.onResize);
      window.addEventListener('pointerup', this.stopResize);
    },
    onResize(e) {
      if (!this.isResizing) return;
      const deltaW = ((e.clientX - this.dragStart.x) / this.pageWidth) * 100;
      const deltaH = ((e.clientY - this.dragStart.y) / this.pageHeight) * 100;

      this.localW = Math.max(10, this.initialPos.w + deltaW);
      this.localH = Math.max(4, this.initialPos.h + deltaH);
    },
    stopResize() {
      if (this.isResizing) {
        this.isResizing = false;
        window.removeEventListener('pointermove', this.onResize);
        window.removeEventListener('pointerup', this.stopResize);

        this.$emit('update', { 
          ...this.annotation, 
          width: this.localW, 
          height: this.localH 
        });
      }
    }
  }
};
</script>

<style scoped>
.signature-annotation-box {
  position: absolute;
  border: 1px dashed transparent;
  box-sizing: border-box;
  user-select: none;
  z-index: 35;
  border-radius: 4px;
}

.signature-annotation-box:hover {
  border-color: rgba(37, 99, 235, 0.4);
}

.signature-annotation-box.is-selected {
  border: 1.5px dashed #2563eb;
  background-color: rgba(37, 99, 235, 0.05);
}

.signature-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.annotation-toolbar {
  position: absolute;
  top: -36px;
  right: 0;
  display: flex;
  gap: 4px;
  background-color: #1e293b;
  border-radius: 6px;
  padding: 2px 4px;
  z-index: 50;
}

.tool-btn {
  background: transparent;
  border: none;
  color: #f8fafc;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.drag-handle { cursor: move; }
.delete-btn { color: #f87171; }

.resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background-color: #2563eb;
  border: 1px solid #ffffff;
  border-radius: 2px;
}

.resize-handle.bottom-right {
  bottom: -5px;
  right: -5px;
  cursor: nwse-resize;
}
</style>