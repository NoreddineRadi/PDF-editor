<template>
  <main ref="viewerStage" class="pdf-viewer-stage" @dragover.prevent="onDragOver" @dragleave.prevent="onDragLeave" @drop.prevent="onDrop">
    <!-- État de Chargement -->
    <div v-if="isLoading" class="state-container">
      <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
      <p class="state-text">Traitement du document...</p>
    </div>

    <!-- Zone de dépôt interactive (Drag & Drop) -->
    <div v-else-if="!hasDocument" class="dropzone-container" :class="{ 'dropzone-active': isDraggingOver }">
      <div class="dropzone-card shadow-3">
        <div class="icon-circle">
          <CloudUpload :size="36" />
        </div>
        <h2 class="dropzone-title">Glissez-déposez vos fichiers PDF ici</h2>
        <p class="dropzone-subtitle">Importez un ou plusieurs PDF pour les réordonner, les extraire ou les fusionner</p>

        <input type="file" ref="dropzoneFileInput" accept="application/pdf" multiple class="hidden-file-input" @change="onFileSelect" />
        <Button class="p-button-raised p-button-primary mt-4 flex align-items-center gap-2" @click="openFilePicker">
          <FolderOpen :size="18" />
          <span>Parcourir les fichiers</span>
        </Button>
      </div>
    </div>

    <!-- Zone de Rendu Document -->
    <div
      v-show="hasDocument && !isLoading"
      class="pdf-viewer-container"
      :style="{ width: viewportWidth + 'px', height: viewportHeight + 'px', position: 'relative' }"
    >
      <div class="pdf-viewport shadow-6">
        <canvas ref="pdfCanvas"></canvas>
        <AnnotationLayer :width="viewportWidth" :height="viewportHeight" />
      </div>
    </div>
  </main>
</template>

<script>
import { mapState, mapActions } from "pinia";
import { usePdfStore } from "@/stores/pdfStore";
import pdfReaderService from "@/services/pdfReader";
import ProgressSpinner from "primevue/progressspinner";
import Button from "primevue/button";
import AnnotationLayer from "./AnnotationLayer.vue";

export default {
  name: "PdfViewer",
  components: {
    ProgressSpinner,
    Button,
    AnnotationLayer,
  },
  data() {
    return {
      currentRenderTask: null,
      activeRenderId: null,
      isDraggingOver: false,
      renderTimeout: null, // Timer pour le debounce du zoom
    };
  },
  computed: {
    ...mapState(usePdfStore, ["documents", "currentPageData", "zoomLevel", "hasDocument", "isLoading"]),
  },
  watch: {
    "currentPageData.pageIndex"() {
      // Rendu immédiat lors du changement de page (0ms)
      this.triggerRender(0);
    },
    zoomLevel() {
      // Debounce de 150ms lors du changement de zoom
      this.triggerRender(150);
    },
    isLoading(newVal) {
      if (!newVal && this.hasDocument) this.triggerRender(0);
    },
  },
  mounted() {
    if (this.hasDocument && !this.isLoading) this.triggerRender(0);

    // Écouteur pour le zoom molette
    if (this.$refs.viewerStage) {
      this.$refs.viewerStage.addEventListener("wheel", this.handleWheelZoom, { passive: false });
    }
  },
  beforeUnmount() {
    if (this.$refs.viewerStage) {
      this.$refs.viewerStage.removeEventListener("wheel", this.handleWheelZoom);
    }
    if (this.renderTimeout) clearTimeout(this.renderTimeout);
    if (this.currentRenderTask) {
      try {
        this.currentRenderTask.cancel();
      } catch (e) {}
    }
  },
  methods: {
    ...mapActions(usePdfStore, ["addFiles", "setZoomLevel"]),

    openFilePicker() {
      this.$refs.dropzoneFileInput?.click();
    },

    /* Déclencheur avec temporisateur (Debounce) */
    triggerRender(delay = 150) {
      if (this.renderTimeout) clearTimeout(this.renderTimeout);

      if (delay === 0) {
        this.$nextTick(() => {
          this.renderCurrentPage();
        });
      } else {
        this.renderTimeout = setTimeout(() => {
          this.$nextTick(() => {
            this.renderCurrentPage();
          });
        }, delay);
      }
    },

    /* Gestion du zoom avec la molette */
    handleWheelZoom(e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        const newZoom = Math.min(Math.max(0.4, this.zoomLevel + delta), 3.0);

        // Mettre à jour le zoom dans le store
        this.setZoomLevel(Math.round(newZoom * 100) / 100);
      }
    },

    async renderCurrentPage() {
      if (!this.currentPageData || !this.$refs.pdfCanvas) return;

      const docObj = this.documents[this.currentPageData.docId];
      if (!docObj || !docObj.pdfJsDoc) return;

      // Identifiant unique de cette tâche de rendu
      const renderId = Symbol("renderId");
      this.activeRenderId = renderId;

      // Annulation propre du rendu précédent s'il y en a un en cours
      if (this.currentRenderTask) {
        try {
          this.currentRenderTask.cancel();
        } catch (e) {}
        this.currentRenderTask = null;
      }

      try {
        const pageNumber = this.currentPageData.pageIndex + 1;

        // 1. On charge la page SANS effacer le canvas
        const page = await pdfReaderService.getPage(docObj.pdfJsDoc, pageNumber);

        // Vérifier si un autre rendu n'a pas été demandé entre temps
        if (this.activeRenderId !== renderId) return;

        const canvas = this.$refs.pdfCanvas;

        // 2. Transmettre le rendu à PDF.js
        const renderTask = pdfReaderService.renderPage(page, canvas, this.zoomLevel, this.currentPageData.rotation);

        this.currentRenderTask = renderTask;
        await renderTask.promise;
      } catch (err) {
        // Ignorer l'erreur d'annulation normale
        if (err?.name === "RenderingCancelledException" || err?.message?.includes("cancelled")) return;
        console.error("Erreur de rendu central :", err);
      } finally {
        if (this.activeRenderId === renderId) {
          this.currentRenderTask = null;
        }
      }
    },

    /* Event Handlers Drag & Drop */
    onDragOver() {
      this.isDraggingOver = true;
    },
    onDragLeave() {
      this.isDraggingOver = false;
    },
    onDrop(e) {
      this.isDraggingOver = false;
      const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type === "application/pdf");
      if (files.length > 0) this.addFiles(files);
    },
    onFileSelect(e) {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) this.addFiles(files);
      e.target.value = "";
    },
  },
};
</script>

<style scoped>
.pdf-viewer-stage {
  flex: 1;
  background-color: #0f172a;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  position: relative;
  height: 100%;
}

.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.state-text {
  color: #94a3b8;
  font-weight: 500;
}

.dropzone-container {
  width: 100%;
  max-width: 520px;
  padding: 2rem;
  transition: transform 0.2s ease;
}

.dropzone-active {
  transform: scale(1.02);
}

.dropzone-card {
  background: #ffffff;
  border: 2px dashed #cbd5e1;
  border-radius: 16px;
  padding: 3rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dropzone-active .dropzone-card {
  border-color: #2563eb;
  background: #f0f9ff;
}

.icon-circle {
  width: 72px;
  height: 72px;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
}

.dropzone-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
}

.dropzone-subtitle {
  font-size: 0.9rem;
  color: #64748b;
  margin: 0;
}

.hidden-file-input {
  display: none;
}

.pdf-viewer-container {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: auto;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 1.5rem;
}

.pdf-viewport {
  position: relative;
  background: #ffffff;
  border-radius: 4px;
  line-height: 0;
}

.pdf-viewport canvas {
  display: block;
  border-radius: 4px;
}
</style>
