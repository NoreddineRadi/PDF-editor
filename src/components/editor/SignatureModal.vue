<template>
  <div v-if="visible" class="modal-overlay" @click.self="close">
    <div class="modal-card">
      <div class="modal-header">
        <div class="title">
          <Pencil size="18" />
          <span>{{ $t('sig.title') }}</span>
        </div>
        <button type="button" class="icon-close-btn" @click="close">
          <Times size="16" />
        </button>
      </div>

      <div class="modal-body">
        <div class="pad-container">
          <!-- Résolution interne x2 pour une signature nette ; l'affichage est en CSS -->
          <canvas
            ref="sigCanvas"
            class="sig-canvas"
            width="900"
            height="360"
            @mousedown="startDrawing"
            @mousemove="draw"
            @mouseup="stopDrawing"
            @mouseleave="stopDrawing"
            @touchstart.prevent="startDrawing"
            @touchmove.prevent="draw"
            @touchend.prevent="stopDrawing"
          ></canvas>
          <div v-if="isEmpty" class="placeholder-hint">{{ $t('sig.hint') }}</div>
        </div>

        <!-- Sur quelles pages ? -->
        <fieldset class="scope-box">
          <legend>{{ $t('sig.applyTo') }}</legend>
          <label class="scope-opt">
            <input v-model="scope" type="radio" value="current" /> {{ $t('sig.scopeCurrent') }}
          </label>
          <label v-if="pageCount > 1" class="scope-opt">
            <input v-model="scope" type="radio" value="all" /> {{ $t('sig.scopeAll', { n: pageCount }) }}
          </label>
          <label v-if="pageCount > 1" class="scope-opt">
            <input v-model="scope" type="radio" value="range" /> {{ $t('sig.scopeRange') }}
          </label>
          <div v-if="scope === 'range'" class="scope-range">
            <input
              v-model="rangeText"
              type="text"
              class="range-input"
              :class="{ invalid: rangeText && !rangePages }"
              :placeholder="$t('sig.rangePlaceholder')"
              inputmode="text"
              autocomplete="off"
            />
            <small :class="{ 'range-error': rangeText && !rangePages }">
              {{ rangeText && !rangePages ? $t('sig.rangeInvalid', { n: pageCount }) : $t('sig.rangeHelp', { n: pageCount }) }}
            </small>
          </div>
        </fieldset>
      </div>

      <div class="modal-footer">
        <Button class="p-button-text p-button-secondary p-button-sm btn-inline" @click="clearPad">
          <Refresh size="14" />
          <span>{{ $t('sig.clear') }}</span>
        </Button>

        <div class="footer-actions">
          <Button :label="$t('sig.cancel')" class="p-button-text p-button-sm" @click="close" />
          <Button
            class="p-button-primary p-button-sm btn-inline"
            :disabled="!canSave"
            @click="saveSignature"
          >
            <Check size="14" />
            <span>{{ $t('sig.apply') }}</span>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Button from 'primevue/button';
import { parsePageRange } from '@/utils/pageRange';

export default {
  name: 'SignatureModal',
  components: { Button },
  props: {
    visible: { type: Boolean, default: false },
    pageCount: { type: Number, default: 1 },
    currentPage: { type: Number, default: 1 } // numéro 1-based
  },
  emits: ['close', 'save'],
  data() {
    return {
      isDrawing: false,
      isEmpty: true,
      ctx: null,
      scope: 'current', // 'current' | 'all' | 'range'
      rangeText: ''
    };
  },
  computed: {
    rangePages() {
      return parsePageRange(this.rangeText, this.pageCount);
    },
    // Pages visées (indices 0-based) ou null si la plage est invalide
    targetPages() {
      if (this.scope === 'all') return Array.from({ length: this.pageCount }, (_, i) => i);
      if (this.scope === 'range') return this.rangePages;
      return [this.currentPage - 1];
    },
    canSave() {
      return !this.isEmpty && !!this.targetPages;
    }
  },
  watch: {
    // immediate : la modale est créée à la demande (v-if + chargement différé), déjà visible
    visible: {
      immediate: true,
      handler(val) {
        if (val) {
          this.$nextTick(() => { this.initCanvas(); });
        }
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
      this.ctx.lineWidth = 5;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.isEmpty = true;
    },
    // Tient compte du rapport entre la taille CSS et la résolution interne du canvas
    getPos(e) {
      const canvas = this.$refs.sigCanvas;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    },
    startDrawing(e) {
      if (!this.ctx) return;
      this.isDrawing = true;
      this.isEmpty = false;
      const pos = this.getPos(e);
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
      // Un simple clic laisse un point
      this.ctx.lineTo(pos.x + 0.1, pos.y + 0.1);
      this.ctx.stroke();
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
    // Recadre l'image sur le tracé : sans cela la signature contient beaucoup de vide transparent
    trimCanvas(canvas) {
      const { width, height } = canvas;
      const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
      let minX = width, minY = height, maxX = -1, maxY = -1;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (data[(y * width + x) * 4 + 3] > 0) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return canvas;

      const pad = 6;
      const sx = Math.max(0, minX - pad);
      const sy = Math.max(0, minY - pad);
      const sw = Math.min(width, maxX + pad + 1) - sx;
      const sh = Math.min(height, maxY + pad + 1) - sy;

      const out = document.createElement('canvas');
      out.width = sw;
      out.height = sh;
      out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
      return out;
    },
    saveSignature() {
      if (!this.canSave) return;
      const trimmed = this.trimCanvas(this.$refs.sigCanvas);
      this.$emit('save', trimmed.toDataURL('image/png'), { pages: this.targetPages });
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
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.35);
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

.title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

.sig-canvas {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 5 / 2;
  cursor: crosshair;
  touch-action: none;
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
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-actions {
  display: flex;
  gap: 0.5rem;
}

.scope-box {
  margin: 1rem 0 0;
  padding: 0.6rem 0.9rem 0.8rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.25rem;
  color: #334155;
  font-size: 0.9rem;
}
.scope-box legend { padding: 0 0.4rem; font-weight: 600; font-size: 0.85rem; color: #475569; }
.scope-opt { display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; }
.scope-range { flex-basis: 100%; display: flex; flex-direction: column; gap: 0.3rem; }
.range-input {
  max-width: 260px;
  padding: 0.4rem 0.6rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.9rem;
}
.range-input.invalid { border-color: #ef4444; }
.scope-range small { color: #64748b; }
.scope-range small.range-error { color: #dc2626; }

.btn-inline {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
