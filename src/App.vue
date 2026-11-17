<template>
  <div class="app-layout">
    <!-- Notifications (erreurs d'import / d'export) -->
    <Toast position="bottom-right" />

    <!-- Barre d'outils du haut -->
    <AppToolbar />

    <!-- Zone principale côte à côte -->
    <div class="app-body">
      <AppSidebar />
      <PdfViewer />
    </div>
  </div>
</template>

<script>
import { mapState } from 'pinia';
import { usePdfStore } from '@/stores/pdfStore';
import Toast from 'primevue/toast';
import AppToolbar from './components/editor/AppToolbar.vue';
import AppSidebar from './components/editor/AppSidebar.vue';
import PdfViewer from './components/editor/PdfViewer.vue';

export default {
  name: 'App',
  components: {
    Toast,
    AppToolbar,
    AppSidebar,
    PdfViewer
  },
  computed: {
    ...mapState(usePdfStore, ['notice'])
  },
  watch: {
    notice(notice) {
      if (!notice) return;
      this.$toast.add({
        severity: notice.severity,
        summary: notice.summary,
        detail: notice.detail,
        life: 6000
      });
    }
  },
  mounted() {
    // Empêche le zoom natif du navigateur (Ctrl + molette) : le zoom est géré par l'application
    window.addEventListener('wheel', this.preventBrowserZoom, { passive: false });
  },
  beforeUnmount() {
    window.removeEventListener('wheel', this.preventBrowserZoom);
  },
  methods: {
    preventBrowserZoom(e) {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    }
  }
};
</script>

<style scoped>
/* Conteneur Global qui prend 100% de la fenêtre */
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* Zone sous la Toolbar : Côte à côte (Row) */
.app-body {
  display: flex;
  flex: 1; /* Remplit tout l'espace restant sous la toolbar */
  flex-direction: row; /* Force le côte à côte */
  overflow: hidden;
  position: relative;
  width: 100%;
}
</style>
