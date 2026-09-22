<template>
  <header class="app-header shadow-2">
    <!-- 1. BLOC GAUCHE : Logo & Import -->
    <div class="header-left">
      <div class="brand">
        <FilePdf size="22" class="brand-icon" />
        <span class="brand-name">PDF Studio</span>
      </div>

      <div class="divider"></div>

      <input 
        type="file" 
        ref="fileInput" 
        accept="application/pdf" 
        multiple 
        class="hidden-file-input" 
        @change="onFileChange" 
      />
      
      <Button 
        class="p-button-outlined p-button-secondary p-button-sm open-btn" 
        @click="triggerFileSelect"
        v-tooltip.bottom="hasDocument ? 'Ajouter des fichiers' : 'Ouvrir un PDF'"
      >
        <Plus size="14" />
        <span class="btn-label">{{ hasDocument ? 'Ajouter' : 'Ouvrir' }}</span>
      </Button>
    </div>

    <!-- 2. BLOC CENTRE : Barre d'outils alignée -->
    <div v-if="hasDocument" class="header-center">
      <div class="toolbar-scroll-container">
        
        <!-- Groupe A : Mode Sélection -->
        <div class="control-group">
          <Button 
            class="p-button-text header-icon-btn" 
            :class="{ 'tool-active': activeTool === 'select' }" 
            @click="setTool('select')"
            v-tooltip.bottom="'Mode Sélection / Navigation'"
          >
            <FolderOpen size="16" />
          </Button>
        </div>

        <!-- Groupe B : Outils d'Annotation -->
        <div class="control-group">
          <Button 
            class="p-button-text header-icon-btn" 
            :class="{ 'tool-active': activeTool === 'draw' }" 
            @click="setTool('draw')"
            v-tooltip.bottom="'Dessin manuscrit'"
          >
            <Pencil size="16" />
          </Button>
          <select 
            v-if="activeTool === 'draw'" 
            :value="strokeWidth" 
            @change="onStrokeWidthChange"
            class="stroke-select"
          >
            <option :value="2">Trait fin (2px)</option>
            <option :value="4">Moyen (4px)</option>
            <option :value="8">Épais (8px)</option>
          </select>

          <Button 
            class="p-button-text header-icon-btn" 
            :class="{ 'tool-active': activeTool === 'highlight' }" 
            @click="setTool('highlight')"
            v-tooltip.bottom="'Surligneur'"
          >
            <Sparkles size="16" />
          </Button>

          <Button 
            class="p-button-text header-icon-btn" 
            :class="{ 'tool-active': activeTool === 'text' }" 
            @click="setTool('text')"
            v-tooltip.bottom="'Ajouter du texte'"
          >
            <FileEdit size="16" />
          </Button>

          <Button 
            class="p-button-text header-icon-btn signature-btn" 
            @click="openSignatureModal"
            v-tooltip.bottom="'Ajouter une signature manuscrite'"
          >
            <Pencil size="16" />
          </Button>
          <div class="color-picker-container" title="Couleur par défaut du texte">
    </div>
        </div>

        <!-- Groupe C : Style & Annulation -->
        <div class="control-group">
          <div class="color-picker-wrapper" v-tooltip.bottom="'Couleur d\'annotation'">
            <input 
              type="color" 
              :value="annotationColor" 
              @input="e => setAnnotationColor(e.target.value)" 
              class="color-picker-input"
            />
          </div>

          <Button 
            class="p-button-text header-icon-btn" 
            @click="undoLastAnnotation"
            v-tooltip.bottom="'Annuler la dernière action'"
          >
            <Undo size="16" />
          </Button>
        </div>

        <!-- Groupe D : Navigation -->
        <div class="control-group">
          <Button 
            class="p-button-text header-icon-btn" 
            :disabled="currentPage <= 1" 
            @click="prevPage"
            v-tooltip.bottom="'Page précédente'"
          >
            <ChevronLeft size="16" />
          </Button>
          
          <span class="page-pill">{{ currentPage }} / {{ pageCount }}</span>
          
          <Button 
            class="p-button-text header-icon-btn" 
            :disabled="currentPage >= pageCount" 
            @click="nextPage"
            v-tooltip.bottom="'Page suivante'"
          >
            <ChevronRight size="16" />
          </Button>
        </div>

      </div>
    </div>

    <!-- 3. BLOC DROITE : Actions d'Exportation -->
    <div class="header-right">
      <Button 
        v-if="hasSelection" 
        class="p-button-sm extract-btn" 
        @click="exportPdf(true)"
      >
        <FileExport size="15" />
        <span class="btn-label">Extraire ({{ selectedCount }})</span>
      </Button>

      <Button 
        v-if="hasDocument" 
        class="p-button-sm export-btn" 
        @click="exportPdf(false)"
      >
        <Download size="15" />
        <span class="btn-label">Exporter</span>
      </Button>
    </div>

    <!-- Modal Signature -->
    <SignatureModal 
      :visible="showSigModal" 
      @close="showSigModal = false" 
      @save="applySignature" 
    />
  </header>
</template>

<script>
import { mapState, mapActions } from 'pinia';
import { usePdfStore } from '@/stores/pdfStore';
import SignatureModal from './SignatureModal.vue';
import Button from 'primevue/button';

export default {
  name: 'AppToolbar',
  components: { Button, SignatureModal },
  data() {
    return { showSigModal: false };
  },
  computed: {
    ...mapState(usePdfStore, [
      'hasDocument', 'currentPage', 'pageCount', 'zoomLevel',
      'hasSelection', 'selectedCount', 'activeTool', 'annotationColor'
    ])
  },
  methods: {
    ...mapActions(usePdfStore, [
      'addFiles', 'setPage', 'setZoom', 'exportPdf', 'clearAll',
      'setTool', 'setAnnotationColor', 'undoLastAnnotation', 'addAnnotationToCurrentPage', 'setStrokeWidth'
    ]),
    triggerFileSelect() { this.$refs.fileInput.click(); },
    onFileChange(e) {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) { this.addFiles(files); e.target.value = ''; }
    },
    prevPage() { this.setPage(this.currentPage - 1); },
    nextPage() { this.setPage(this.currentPage + 1); },
    openSignatureModal() { this.showSigModal = true; },
    applySignature(dataUrl) {
      const newSignatureAnno = {
        type: 'signature',
        dataUrl: dataUrl,
        x: 35,    // Position centrale par défaut (35%)
        y: 40,    // Position centrale par défaut (40%)
        width: 25, // Largeur 25% de la page
        height: 10  // Hauteur 10% de la page
      };

      // Ajoute au store Pinia
      this.addAnnotationToCurrentPage(newSignatureAnno);
    },
    onStrokeWidthChange(e) {
      this.setStrokeWidth(Number(e.target.value));
    }
  }
};
</script>

<style scoped>
/* Structure de base du Header */
.app-header {
  height: 56px;
  background-color: #0f172a;
  color: #f8fafc;
  padding: 0 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  z-index: 100;
  border-bottom: 1px solid #1e293b;
  width: 100%;
  box-sizing: border-box;
}

/* Alignement strict des 3 sections principales */
.header-left, 
.header-center, 
.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-left { flex-shrink: 0; }
.header-right { flex-shrink: 0; }

.brand { 
  display: flex; 
  align-items: center; 
  gap: 0.5rem; 
  font-weight: 700; 
  font-size: 1rem; 
  color: #ffffff; 
  white-space: nowrap; 
}
.brand-icon { color: #ef4444; display: block; }

.divider { 
  width: 1px; 
  height: 20px; 
  background-color: #334155; 
  margin: 0 0.25rem;
}

.hidden-file-input { display: none; }

:deep(.open-btn) { 
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.5rem !important;
  color: #e2e8f0 !important; 
  border-color: #475569 !important; 
  background: transparent !important; 
  white-space: nowrap;
  height: 34px !important;
}

/* Zone centrale scrollable mais centrée */
.header-center {
  flex: 1;
  min-width: 0;
  justify-content: center;
}

.toolbar-scroll-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  overflow-x: auto;
  white-space: nowrap;
  padding: 2px 0;
  scrollbar-width: none;
}
.toolbar-scroll-container::-webkit-scrollbar { display: none; }

/* Groupes d'outils avec hauteur fixe pour alignement parfait */
.control-group {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 36px;
  background-color: #1e293b;
  padding: 0 4px;
  border-radius: 8px;
  border: 1px solid #334155;
  flex-shrink: 0;
  box-sizing: border-box;
}

/* Boutons d'icônes standardisés */
:deep(.p-button.header-icon-btn) {
  width: 30px !important;
  height: 30px !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 6px !important;
  border: none !important;
  background: transparent !important;
  color: #cbd5e1 !important;
  margin: 0 !important;
}

:deep(.p-button.header-icon-btn:hover) {
  background-color: #334155 !important;
  color: #ffffff !important;
}

:deep(.p-button.header-icon-btn.tool-active) {
  background-color: #2563eb !important;
  color: #ffffff !important;
}

.signature-btn { color: #34d399 !important; }

/* Sélecteur de couleur encapsulé pour s'aligner avec les boutons 30x30 */
.color-picker-wrapper {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-picker-input {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  background: transparent;
  padding: 0;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
}
.color-picker-input::-webkit-color-swatch-wrapper { padding: 0; }
.color-picker-input::-webkit-color-swatch { border: 1.5px solid #ffffff; border-radius: 50%; }

/* Badge de numéro de page */
.page-pill { 
  font-size: 0.8rem; 
  font-weight: 600; 
  color: #cbd5e1; 
  padding: 0 6px; 
  display: flex;
  align-items: center;
  height: 30px;
  line-height: 1;
}

/* Boutons d'exportation */
:deep(.extract-btn),
:deep(.export-btn) { 
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.5rem !important;
  height: 34px !important;
  white-space: nowrap;
}

:deep(.extract-btn) { background-color: #10b981 !important; border: none !important; color: #ffffff !important; }
:deep(.export-btn) { background-color: #2563eb !important; border: none !important; color: #ffffff !important; }

/* Responsive : Masque le texte des boutons sur petit écran */
@media (max-width: 1024px) {
  .btn-label { display: none; }
}
</style>