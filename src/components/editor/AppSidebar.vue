<template>
  <aside class="app-sidebar" :class="{ 'collapsed': isCollapsed }">
    <div class="sidebar-header">
      <span v-if="!isCollapsed" class="sidebar-title">Pages ({{ pagesOrder.length }})</span>
      <Button 
        class="p-button-text p-button-secondary p-button-sm toggle-btn"
        @click="isCollapsed = !isCollapsed"
        v-tooltip.right="isCollapsed ? 'Déplier la barre latérale' : 'Replier'"
      >
        <ChevronRight v-if="isCollapsed" size="16" />
        <ChevronLeft v-else size="16" />
      </Button>
    </div>

    <!-- Actions de sélection rapide -->
    <div v-if="hasDocument && !isCollapsed" class="selection-tools">
      <Button 
        label="Tout cocher" 
        class="p-button-text p-button-sm tool-btn" 
        @click="selectAllPages(true)" 
      />
      <Button 
        label="Tout décocher" 
        class="p-button-text p-button-sm tool-btn" 
        @click="selectAllPages(false)" 
      />
    </div>

    <div v-if="hasDocument && !isCollapsed" class="sidebar-content">
      <draggable 
        v-model="draggablePages" 
        item-key="id"
        animation="200"
        ghost-class="ghost-thumbnail"
        class="flex flex-column gap-3"
      >
        <template #item="{ element, index }">
          <ThumbnailCard
            :pageItem="element"
            :displayIndex="index"
            :isSelected="currentPage === index + 1"
            @select="setPage(index + 1)"
            @rotate="rotatePage(index)"
            @delete="deletePage(index)"
            @toggle-select="togglePageSelection(index)"
          />
        </template>
      </draggable>
    </div>
  </aside>
</template>

<script>
import { mapState, mapActions } from 'pinia';
import { usePdfStore } from '@/stores/pdfStore';
import draggable from 'vuedraggable';
import ThumbnailCard from './ThumbnailCard.vue';
import Button from 'primevue/button';

export default {
  name: 'AppSidebar',
  components: { draggable, ThumbnailCard, Button },
  data() {
    return { isCollapsed: false };
  },
  computed: {
    ...mapState(usePdfStore, ['hasDocument', 'pagesOrder', 'currentPage']),
    draggablePages: {
      get() { return this.pagesOrder; },
      set(newList) { this.reorderPages(newList); }
    }
  },
  methods: {
    ...mapActions(usePdfStore, ['setPage', 'rotatePage', 'deletePage', 'togglePageSelection', 'selectAllPages', 'reorderPages'])
  }
};
</script>

<style scoped>
.app-sidebar {
  width: 260px; /* Ou la largeur souhaitée */
  min-width: 260px;
  height: 100%;
  flex-shrink: 0; /* CRUCIAL : empêche Flexbox de réduire la sidebar */
  background-color: #1e293b;
  border-right: 1px solid #334155;
  overflow-y: auto; /* Scrollbar propre si la liste des pages est longue */
  display: flex;
  flex-direction: column;
}
.app-sidebar.collapsed { width: 48px; }

.sidebar-header {
  height: 48px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #f1f5f9;
}

.sidebar-title {
  font-weight: 700;
  font-size: 0.85rem;
  color: #475569;
  text-transform: uppercase;
}

.selection-tools {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.tool-btn {
  font-size: 0.75rem !important;
  padding: 2px 4px !important;
}

.sidebar-content { flex: 1; overflow-y: auto; padding: 1rem; }
.ghost-thumbnail { opacity: 0.3; border: 2px dashed #2563eb !important; }
</style>