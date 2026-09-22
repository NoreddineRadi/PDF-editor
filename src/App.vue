<template>
  <div class="app-layout">
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
import AppToolbar from './components/editor/AppToolbar.vue';
import AppSidebar from './components/editor/AppSidebar.vue';
import PdfViewer from './components/editor/PdfViewer.vue';

export default {
  name: 'App',
  components: {
    AppToolbar,
    AppSidebar,
    PdfViewer
  }, 
  mounted() {
    window.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }
  }, { passive: false });
  },
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