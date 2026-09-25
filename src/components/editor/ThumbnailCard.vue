<template>
  <div 
    class="thumbnail-card"
    :class="{ 'active': isSelected, 'selected-for-export': pageItem.selected }"
    @click="$emit('select')"
  >
    <div class="card-header">
      <!-- Checkbox de sélection d'extraction -->
      <button 
        type="button" 
        class="checkbox-btn"
        :class="{ 'checked': pageItem.selected }"
        @click.stop="$emit('toggle-select')"
        v-tooltip.top="pageItem.selected ? 'Désélectionner' : 'Sélectionner pour extraction'"
      >
        <Check v-if="pageItem.selected" size="12" />
      </button>

      <span class="page-badge">Page {{ displayIndex + 1 }}</span>

      <div class="card-actions">
        <button 
          type="button" 
          class="action-btn" 
          v-tooltip.top="'Pivoter'"
          @click.stop="$emit('rotate')"
        >
          <Refresh size="12" />
        </button>
        <button 
          type="button" 
          class="action-btn btn-danger" 
          v-tooltip.top="'Supprimer'"
          @click.stop="$emit('delete')"
        >
          <Trash size="12" />
        </button>
      </div>
    </div>

    <div class="canvas-box">
      <canvas ref="thumbCanvas"></canvas>
    </div>
  </div>
</template>

<script>
import { mapState } from 'pinia';
import { usePdfStore } from '@/stores/pdfStore';
import pdfReaderService from '@/services/pdfReader';

export default {
  name: 'ThumbnailCard',
  props: {
    pageItem: { type: Object, required: true },
    displayIndex: { type: Number, required: true },
    isSelected: { type: Boolean, default: false }
  },
  emits: ['select', 'rotate', 'delete', 'toggle-select'],
  computed: {
    ...mapState(usePdfStore, ['documents'])
  },
  watch: {
    'pageItem.rotation': 'renderThumbnail',
    documents: { deep: true, handler: 'renderThumbnail' }
  },
  mounted() {
    this.renderThumbnail();
  },
  methods: {
    async renderThumbnail() {
      const docObj = this.documents[this.pageItem.docId];
      if (!docObj || !this.$refs.thumbCanvas) return;

      try {
        const pageNumber = this.pageItem.pageIndex + 1;
        const page = await pdfReaderService.getPage(docObj.pdfJsDoc, pageNumber);
        
        pdfReaderService.renderPage(
          page,
          this.$refs.thumbCanvas,
          0.18,
          this.pageItem.rotation
        );
      } catch (err) {
        console.error('Erreur rendu vignette :', err);
      }
    }
  }
};
</script>

<style scoped>
.thumbnail-card {
  background: #ffffff;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  position: relative;
}

.thumbnail-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.thumbnail-card.active {
  border-color: #2563eb;
  background-color: #eff6ff;
}

.thumbnail-card.selected-for-export {
  border-color: #10b981;
  background-color: #ecfdf5;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  gap: 4px;
}

.checkbox-btn {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #ffffff;
  transition: all 0.15s ease;
}

.checkbox-btn.checked {
  background: #10b981;
  border-color: #10b981;
}

.page-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
}

.card-actions {
  display: flex;
  gap: 2px;
}

.action-btn {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease;
}

.action-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.action-btn.btn-danger:hover {
  background: #fee2e2;
  color: #ef4444;
}

.canvas-box {
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f8fafc;
  border-radius: 4px;
  padding: 6px;
  min-height: 100px;
}

.canvas-box canvas {
  max-width: 100%;
  height: auto;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}
</style>