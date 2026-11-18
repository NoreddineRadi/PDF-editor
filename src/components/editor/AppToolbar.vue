<template>
  <header class="app-header shadow-2">
    <!-- 1. BLOC GAUCHE : Logo & Import -->
    <div class="header-left">
      <div class="brand">
        <FilePdf size="22" class="brand-icon" />
        <span class="brand-name">PDF Studio</span>
        <span class="app-version" v-tooltip.bottom="buildInfo">v{{ appVersion }} · {{ appCommit }}</span>
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

    <!-- 2. BLOC CENTRE : outils organisés en groupes -->
    <div v-if="hasDocument" class="header-center">
      <div class="toolbar-scroll-container">

        <!-- Sélection -->
        <div class="control-group">
          <Button
            class="p-button-text header-icon-btn"
            :class="{ 'tool-active': activeTool === 'select' }"
            @click="setTool('select')"
            v-tooltip.bottom="'Sélectionner / déplacer / pivoter (Échap)'"
          >
            <ToolIcon name="select" />
          </Button>
        </div>

        <!-- Dessiner -->
        <div class="control-group">
          <Button
            class="p-button-text header-icon-btn"
            :class="{ 'tool-active': activeTool === 'draw' }"
            @click="setTool('draw')"
            v-tooltip.bottom="'Crayon'"
          >
            <ToolIcon name="pen" />
          </Button>
          <Button
            class="p-button-text header-icon-btn"
            :class="{ 'tool-active': activeTool === 'highlight' }"
            @click="setTool('highlight')"
            v-tooltip.bottom="'Surligneur'"
          >
            <ToolIcon name="highlighter" />
          </Button>
          <Button
            class="p-button-text header-icon-btn"
            :class="{ 'tool-active': activeTool === 'eraser' }"
            @click="setTool('eraser')"
            v-tooltip.bottom="'Gomme : supprime les éléments ajoutés que vous touchez'"
          >
            <ToolIcon name="eraser" />
          </Button>
          <Button
            class="p-button-text header-icon-btn"
            :class="{ 'tool-active': activeTool === 'mask' }"
            @click="setTool('mask')"
            v-tooltip.bottom="'Blanco : recouvre une zone du PDF (texte natif compris). Masquage visuel : le texte reste dans le fichier.'"
          >
            <ToolIcon name="mask" />
          </Button>
        </div>

        <!-- Insérer -->
        <div class="control-group">
          <Button
            class="p-button-text header-icon-btn"
            :class="{ 'tool-active': activeTool === 'text' }"
            @click="setTool('text')"
            v-tooltip.bottom="'Ajouter du texte'"
          >
            <ToolIcon name="text" />
          </Button>
          <input
            type="file"
            ref="imageInput"
            accept="image/png,image/jpeg,image/webp,image/gif"
            class="hidden-file-input"
            @change="onImageChange"
          />
          <Button
            class="p-button-text header-icon-btn"
            @click="triggerImageSelect"
            v-tooltip.bottom="'Insérer une image (PNG, JPG)'"
          >
            <ToolIcon name="image" />
          </Button>
          <Button
            class="p-button-text header-icon-btn signature-btn"
            @click="openSignatureModal"
            v-tooltip.bottom="'Ajouter une signature manuscrite'"
          >
            <ToolIcon name="signature" />
          </Button>
        </div>

        <!-- Style : n'apparaît que lorsque l'outil actif ou l'élément sélectionné en a besoin -->
        <div v-if="styleContext" class="control-group style-group">
          <!-- Surligneur -->
          <template v-if="styleContext === 'highlight'">
            <button
              v-for="c in highlightPalette"
              :key="c"
              class="swatch"
              :class="{ active: highlightColorValue.toLowerCase() === c.toLowerCase() }"
              :style="{ backgroundColor: c }"
              :title="c"
              @click="setHighlightColor(c)"
            ></button>
            <div class="color-picker-wrapper" v-tooltip.bottom="'Autre couleur'">
              <input type="color" :value="highlightColorValue" @input="(e) => setHighlightColor(e.target.value)" class="color-picker-input" />
            </div>
            <span class="style-sep"></span>
            <button
              v-for="p in highlightPresets"
              :key="p.value"
              class="preset-btn"
              :class="{ active: highlightWidthValue === p.value }"
              :title="p.title"
              @click="setHighlightWidth(p.value)"
            >{{ p.label }}</button>
            <input
              type="range"
              min="4"
              max="60"
              step="1"
              class="width-slider"
              :value="highlightWidthValue"
              @input="(e) => setHighlightWidth(Number(e.target.value))"
            />
            <span class="width-label">{{ highlightWidthValue }} px</span>
          </template>

          <!-- Masque -->
          <template v-else-if="styleContext === 'mask'">
            <button
              class="preset-btn"
              :class="{ active: maskIsWhite }"
              title="Recouvrir en blanc"
              @click="setMaskColor('#ffffff')"
            >Blanc</button>
            <button
              class="preset-btn"
              :class="{ active: maskIsAuto }"
              title="Reprend la couleur du fond de la page autour de la zone"
              @click="setMaskColor('auto')"
            >Auto</button>
            <div class="color-picker-wrapper" v-tooltip.bottom="'Couleur du masque'">
              <input type="color" :value="maskColorValue" @input="(e) => setMaskColor(e.target.value)" class="color-picker-input" />
            </div>
          </template>

          <!-- Crayon / texte -->
          <template v-else>
            <div class="color-picker-wrapper" v-tooltip.bottom="'Couleur'">
              <input type="color" :value="annotationColor" @input="(e) => setAnnotationColor(e.target.value)" class="color-picker-input" />
            </div>
            <select v-if="styleContext === 'draw'" :value="strokeWidth" @change="onStrokeWidthChange" class="stroke-select">
              <option :value="2">Fin (2px)</option>
              <option :value="3">Normal (3px)</option>
              <option :value="4">Moyen (4px)</option>
              <option :value="8">Épais (8px)</option>
            </select>
          </template>
        </div>

        <!-- Historique -->
        <div class="control-group">
          <Button
            class="p-button-text header-icon-btn"
            :disabled="!canUndo"
            @click="undo"
            v-tooltip.bottom="'Annuler (Ctrl+Z)'"
          >
            <ToolIcon name="undo" />
          </Button>
          <Button
            class="p-button-text header-icon-btn"
            :disabled="!canRedo"
            @click="redo"
            v-tooltip.bottom="'Rétablir (Ctrl+Y)'"
          >
            <ToolIcon name="redo" />
          </Button>
        </div>

        <!-- Navigation -->
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
import ToolIcon from './ToolIcon.vue';
import Button from 'primevue/button';
import { appInfo, describeBuild } from '@/utils/appInfo';

export default {
  name: 'AppToolbar',
  components: { Button, SignatureModal, ToolIcon },
  data() {
    return {
      showSigModal: false,
      appVersion: appInfo.version,
      appCommit: appInfo.commit,
      buildInfo: describeBuild(),
      highlightPalette: ['#FFFF00', '#7CFC00', '#FF8DC7', '#FFA500', '#4FC3F7'],
      highlightPresets: [
        { label: 'S', value: 10, title: 'Fin (10 px)' },
        { label: 'M', value: 20, title: 'Moyen (20 px)' },
        { label: 'L', value: 36, title: 'Large (36 px)' }
      ]
    };
  },
  computed: {
    ...mapState(usePdfStore, [
      'hasDocument', 'currentPage', 'pageCount',
      'hasSelection', 'selectedCount', 'activeTool', 'annotationColor',
      'strokeWidth', 'highlightColor', 'highlightWidth', 'maskColor',
      'selectedAnnotation', 'canUndo', 'canRedo'
    ]),

    // Quel panneau de réglages afficher ? Dépend de l'outil actif, sinon de l'élément sélectionné.
    styleContext() {
      const tool = this.activeTool;
      if (tool === 'highlight' || tool === 'mask' || tool === 'draw' || tool === 'text') return tool;
      if (tool === 'eraser') return null;
      const type = this.selectedAnnotation?.type;
      if (type === 'highlight') return 'highlight';
      if (type === 'mask') return 'mask';
      if (type === 'drawing') return 'draw';
      if (type === 'text') return 'text';
      return null;
    },

    // Valeurs affichées : celles de l'élément sélectionné s'il y en a un, sinon les réglages de l'outil
    selectedHighlight() {
      const a = this.selectedAnnotation;
      return a && a.type === 'highlight' && this.activeTool === 'select' ? a : null;
    },
    highlightColorValue() {
      return this.selectedHighlight ? this.selectedHighlight.color : this.highlightColor;
    },
    highlightWidthValue() {
      return Math.round(this.selectedHighlight ? this.selectedHighlight.strokeWidth : this.highlightWidth);
    },
    // Blanco : un masque est-il sélectionné ? Sinon on affiche le réglage de l'outil.
    selectedMask() {
      const a = this.selectedAnnotation;
      return a && a.type === 'mask' && this.activeTool === 'select' ? a : null;
    },
    maskColorValue() {
      if (this.selectedMask) return this.selectedMask.color || '#ffffff';
      return this.maskColor === 'auto' ? '#ffffff' : this.maskColor;
    },
    maskIsWhite() {
      return this.maskColorValue.toLowerCase() === '#ffffff' && (this.selectedMask || this.maskColor !== 'auto');
    },
    maskIsAuto() {
      return !this.selectedMask && this.maskColor === 'auto';
    }
  },
  methods: {
    ...mapActions(usePdfStore, [
      'addFiles', 'setPage', 'exportPdf', 'clearAll', 'setTool',
      'setAnnotationColor', 'setStrokeWidth', 'setHighlightColor', 'setHighlightWidth', 'setMaskColor',
      'undo', 'redo', 'addAnnotationToCurrentPage', 'addImageFromFile'
    ]),
    triggerFileSelect() { this.$refs.fileInput.click(); },
    onFileChange(e) {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) { this.addFiles(files); e.target.value = ''; }
    },
    prevPage() { this.setPage(this.currentPage - 1); },
    nextPage() { this.setPage(this.currentPage + 1); },
    openSignatureModal() { this.showSigModal = true; },
    triggerImageSelect() { this.$refs.imageInput.click(); },
    onImageChange(e) {
      const file = e.target.files && e.target.files[0];
      if (file) this.addImageFromFile(file);
      e.target.value = ''; // permet de re-sélectionner le même fichier
    },
    applySignature(dataUrl) {
      // On repasse en sélection pour que la signature soit tout de suite déplaçable / redimensionnable
      this.setTool('select');
      this.addAnnotationToCurrentPage({
        type: 'signature',
        dataUrl,
        x: 35,     // Position centrale par défaut
        y: 40,
        width: 25, // 25 % de la largeur de la page
        height: 10,
        rotation: 0
      }, { select: true });
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

/* Réglages contextuels (surligneur, masque, crayon) */
.style-group { gap: 6px; padding: 0 8px; }

.style-sep { width: 1px; height: 18px; background-color: #475569; margin: 0 2px; }

.swatch {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}
.swatch:hover { transform: scale(1.12); }
.swatch.active { border-color: #ffffff; box-shadow: 0 0 0 2px #2563eb; }

.preset-btn {
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border-radius: 5px;
  border: 1px solid #475569;
  background: transparent;
  color: #cbd5e1;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}
.preset-btn:hover { background-color: #334155; }
.preset-btn.active { background-color: #2563eb; border-color: #2563eb; color: #ffffff; }

.width-slider { width: 90px; accent-color: #2563eb; cursor: pointer; }
.width-label { color: #94a3b8; font-size: 0.75rem; min-width: 38px; }

.stroke-select {
  height: 24px;
  border-radius: 5px;
  border: 1px solid #475569;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 0.75rem;
}

:deep(.p-button.header-icon-btn:disabled) { opacity: 0.35; }

/* Numéro de version / commit déployé */
.app-version {
  margin-left: 8px;
  font-size: 0.7rem;
  color: #94a3b8;
  white-space: nowrap;
  cursor: default;
}
@media (max-width: 900px) {
  .app-version { display: none; }
}

/* Responsive : Masque le texte des boutons sur petit écran */
@media (max-width: 1024px) {
  .btn-label { display: none; }
}
</style>