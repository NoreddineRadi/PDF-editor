<template>
  <div v-if="visible" class="modal-overlay" @click.self="close">
    <div class="modal-card shadow-8">
      <div class="modal-header">
        <div class="title flex align-items-center gap-2">
          <Pencil size="18" />
          <span>Créer votre signature manuscrite</span>
        </div>
        <button type="button" class="icon-close-btn" @click="close">
          <Times size="16" />
        </button>
      </div>

      <div class="modal-body">
        <div class="pad-container">
          <canvas 
            ref="sigCanvas" 
            width="450" 
            height="180" 
            @mousedown="startDrawing"
            @mousemove="draw"
            @mouseup="stopDrawing"
            @mouseleave="stopDrawing"
            @touchstart.prevent="startDrawing"
            @touchmove.prevent="draw"
            @touchend.prevent="stopDrawing"
          ></canvas>
          <div v-if="isEmpty" class="placeholder-hint">Dessinez votre signature ici</div>
        </div>
      </div>

      <div class="modal-footer flex justify-content-between align-items-center">
        <Button class="p-button-text p-button-secondary p-button-sm flex align-items-center gap-2" @click="clearPad">
          <Refresh size="14" />
          <span>Effacer</span>
        </Button>

        <div class="flex gap-2">
          <Button label="Annuler" class="p-button-text p-button-sm" @click="close" />
          <Button 
            class="p-button-primary p-button-sm flex align-items-center gap-2" 
            :disabled="isEmpty"
            @click="saveSignature"
          >
            <Check size="14" />
            <span>Appliquer sur la page</span>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Button from 'primevue/button';

export default {
  name: 'SignatureModal',
  components: { Button },
  props: {
    visible: { type: Boolean, default: false }
  },
  emits: ['close', 'save'],
  data() {
    return {
      isDrawing: false,
      isEmpty: true,
      ctx: null
    };
  },
  watch: {
    visible(val) {
      if (val) {
        this.$nextTick(() => { this.initCanvas(); });
      }
    }
  },
  methods: {
    initCanvas() {
      const canvas = this.$refs.sigCanvas;
      if (!canvas) return;
      this.ctx = canvas.getContext('2d');
      this.clearPad();
    },
    clearPad() {
      if (!this.ctx) return;
      const canvas = this.$refs.sigCanvas;
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.ctx.strokeStyle = '#0f172a';
      this.ctx.lineWidth = 2.5;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.isEmpty = true;
    },
    getPos(e) {
      const rect = this.$refs.sigCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    },
    startDrawing(e) {
      this.isDrawing = true;
      this.isEmpty = false;
      const pos = this.getPos(e);
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
    },
    draw(e) {
      if (!this.isDrawing) return;
      const pos = this.getPos(e);
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
    },
    stopDrawing() {
      this.isDrawing = false;
    },
    saveSignature() {
      if (this.isEmpty) return;
      const dataUrl = this.$refs.sigCanvas.toDataURL('image/png');
      this.$emit('save', dataUrl);
      this.close();
    },
    close() {
      this.$emit('close');
    }
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-card {
  background: #ffffff;
  border-radius: 12px;
  width: 500px;
  max-width: 90vw;
  overflow: hidden;
}

.modal-header {
  padding: 1rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  color: #0f172a;
}

.icon-close-btn {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}
.icon-close-btn:hover { background: #e2e8f0; color: #0f172a; }

.modal-body { padding: 1.25rem; }

.pad-container {
  border: 2px dashed #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.placeholder-hint {
  position: absolute;
  color: #94a3b8;
  font-size: 0.9rem;
  pointer-events: none;
}

.modal-footer {
  padding: 1rem 1.25rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}
</style>