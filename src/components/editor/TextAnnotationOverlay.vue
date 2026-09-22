<template>
  <div 
    class="text-annotation-box"
    :class="{ 'is-selected': isSelected, 'is-dragging': isDragging }"
    :style="boxStyle"
    @click.stop="selectAnnotation"
  >
    <!-- Barre d'outils flottante (Intelligente : passe en dessous si trop haut) -->
    <div 
      v-if="isSelected" 
      class="annotation-toolbar"
      :class="{ 'position-below': isNearTop }"
    >
      <button class="tool-btn" @click.stop="decreaseFontSize" title="Réduire la taille">-</button>
      <span class="font-size-label">{{ annotation.fontSize || 16 }}px</span>
      <button class="tool-btn" @click.stop="increaseFontSize" title="Agrandir la taille">+</button>
      <div class="toolbar-divider"></div>
      <div class="color-picker-wrapper" title="Couleur du texte">
        <input 
          type="color" 
          :value="annotation.color || '#000000'" 
          class="color-picker-input"
          @input="changeColor"
          @click.stop
        />
      </div>
      <div class="toolbar-divider"></div>
      <button class="tool-btn drag-handle" @pointerdown.stop="startDrag" title="Déplacer">✥</button>
      <button class="tool-btn delete-btn" @click.stop="removeSelf" title="Supprimer">✕</button>
    </div>

    <!-- Champ de saisie du texte -->
    <textarea
      ref="textareaRef"
      v-model="localText"
      class="text-input"
      :style="textStyle"
      placeholder="Saisissez votre texte..."
      @input="onTextChange"
      @focus="selectAnnotation"
      row="1"
      col="200"
    ></textarea>

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
  name: 'TextAnnotationOverlay',
  props: {
    annotation: { type: Object, required: true },
    pageWidth: { type: Number, required: true },
    pageHeight: { type: Number, required: true },
    isSelected: { type: Boolean, default: false }
  },
  emits: ['update', 'delete', 'select'],
  data() {
    return {
      localText: this.annotation.text || '',
      // Positions locales pour ne pas spamer Pinia pendant le drag
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
    // Inverse la position de la barre si l'annotation est trop proche du haut (< 8%)
    isNearTop() {
      return this.localY < 8;
    },

    boxStyle() {
      const w = Math.max((this.localW / 100) * this.pageWidth, 100);
      const h = Math.max((this.localH / 100) * this.pageHeight, 9);
      const left = (this.localX / 100) * this.pageWidth;
      const top = (this.localY / 100) * this.pageHeight;

      return {
        left: `${left}px`,
        top: `${top}px`,
        width: `${w}px`,
        height: `${h}px`
      };
    },

    textStyle() {
      return {
        fontSize: `${this.annotation.fontSize || 16}px`,
        color: this.annotation.color || '#000000'
      };
    }
  },
  watch: {
    annotation: {
      deep: true,
      handler(newVal) {
        // Met à jour les valeurs locales seulement si l'utilisateur n'est pas en train de manipuler le bloc
        if (!this.isDragging && !this.isResizing) {
          this.localX = newVal.x;
          this.localY = newVal.y;
          this.localW = newVal.width;
          this.localH = newVal.height;
          this.localText = newVal.text || '';
        }
      }
    },
    isSelected(newVal) {
      if (newVal) {
        this.$nextTick(() => this.$refs.textareaRef?.focus());
      }
    }
  },
  mounted() {
    if (this.isSelected) {
      this.$nextTick(() => this.$refs.textareaRef?.focus());
    }
  },
  methods: {
    selectAnnotation() {
      this.$emit('select', this.annotation.id);
    },

    onTextChange() {
      this.$emit('update', { ...this.annotation, text: this.localText });
    },

    increaseFontSize() {
      const current = this.annotation.fontSize || 16;
      this.$emit('update', { ...this.annotation, fontSize: current + 2 });
    },

    decreaseFontSize() {
      const current = this.annotation.fontSize || 16;
      if (current > 8) {
        this.$emit('update', { ...this.annotation, fontSize: current - 2 });
      }
    },

    removeSelf() {
      this.$emit('delete', this.annotation.id);
    },

    /* GLISSER - DÉPOSER (DRAG) */
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

      // Calcul des coordonnées locales instantanées
      this.localX = Math.max(0, Math.min(100 - this.localW, this.initialPos.x + deltaX));
      this.localY = Math.max(0, Math.min(100 - this.localH, this.initialPos.y + deltaY));
    },

    stopDrag() {
      if (this.isDragging) {
        this.isDragging = false;
        window.removeEventListener('pointermove', this.onDrag);
        window.removeEventListener('pointerup', this.stopDrag);
        
        // 🚀 MET À JOUR PINIA UNIQUEMENT À LA FIN DU DÉPLACEMENT
        this.$emit('update', { 
          ...this.annotation, 
          x: this.localX, 
          y: this.localY 
        });
      }
    },

    /* REDIMENSIONNEMENT (RESIZE) */
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

      this.localW = Math.max(8, this.initialPos.w + deltaW);
      this.localH = Math.max(3, this.initialPos.h + deltaH);
    },

    stopResize() {
      if (this.isResizing) {
        this.isResizing = false;
        window.removeEventListener('pointermove', this.onResize);
        window.removeEventListener('pointerup', this.stopResize);

        // 🚀 MET À JOUR PINIA UNIQUEMENT À LA FIN DU REDIMENSIONNEMENT
        this.$emit('update', { 
          ...this.annotation, 
          width: this.localW, 
          height: this.localH 
        });
      }
    },

    changeColor(e) {
      const newColor = e.target.value;
      this.$emit('update', { 
        ...this.annotation, 
        color: newColor 
      });
    }
  }
};
</script>

<style scoped>
.text-annotation-box {
  position: absolute;
  border: 1px dashed transparent;
  box-sizing: border-box;
  user-select: none;
  z-index: 30;
  border-radius: 4px;
  transition: border-color 0.15s ease;
}

.text-annotation-box:hover {
  border-color: rgba(37, 99, 235, 0.4);
}

.text-annotation-box.is-selected {
  border: 1.5px dashed #2563eb;
  background-color: rgba(255, 255, 255, 0.85);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
}

/* Champ texte lisible et dégagé */
.text-input {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  resize: none;
  font-family: inherit;
  line-height: 1.3;
  padding: 4px 6px;
  box-sizing: border-box;
  overflow: hidden;
}

/* Barre d'outils dégagée au-dessus */
.annotation-toolbar {
  position: absolute;
  top: -42px;
  left: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 3px 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  z-index: 50;
  white-space: nowrap;
}

/* Si le texte est tout en haut de la page, la barre passe en dessous */
.annotation-toolbar.position-below {
  top: auto;
  bottom: -42px;
}

.tool-btn {
  background: transparent;
  border: none;
  color: #f8fafc;
  min-width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  transition: background-color 0.15s;
}

.tool-btn:hover { background-color: #334155; }
.drag-handle { cursor: move; }
.delete-btn { color: #f87171; }
.delete-btn:hover { background-color: rgba(239, 68, 68, 0.25); }

.font-size-label {
  color: #94a3b8;
  font-size: 12px;
  min-width: 30px;
  text-align: center;
}

.toolbar-divider {
  width: 1px;
  height: 16px;
  background-color: #475569;
  margin: 0 2px;
}

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

/* Sélecteur de couleur rond personnalisé */
.color-picker-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
}

.color-picker-input {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border: 1px solid #475569;
  border-radius: 50%;
  cursor: pointer;
  background: transparent;
  padding: 0;
  outline: none;
  transition: transform 0.15s ease;
}

.color-picker-input:hover {
  transform: scale(1.15);
}

.color-picker-input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker-input::-webkit-color-swatch {
  border: none;
  border-radius: 50%;
}

.color-picker-input::-moz-color-swatch {
  border: none;
  border-radius: 50%;
}
</style>