<template>
  <div class="tool-menu">
    <button
      ref="trigger"
      class="p-button p-component p-button-text header-icon-btn tm-trigger"
      :class="{ 'tool-active': active }"
      :title="title"
      @click="toggle"
    >
      <ToolIcon :name="icon" />
      <span class="tm-caret">▾</span>
    </button>

    <!-- Téléporté dans <body> : la barre d'outils défile et rognerait un menu positionné dans son flux -->
    <Teleport to="body">
      <div v-if="open" ref="panel" class="tm-panel" :style="panelStyle" @pointerdown.stop>
        <button
          v-for="item in items"
          :key="item.value"
          class="tm-item"
          :class="{ current: item.value === current }"
          @click="pick(item)"
        >
          <span class="tm-preview" :style="{ width: (item.w || 18) + 'px', height: (item.h || 18) + 'px' }">
            <ToolIcon v-if="item.icon" :name="item.icon" :size="18" />
            <ShapeGraphic v-else :annotation="{ ...item.ann, color: '#e2e8f0', fill: null }" :stroke-px="1.6" />
          </span>
          <span class="tm-label">{{ item.label }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script>
import ToolIcon from './ToolIcon.vue';
import ShapeGraphic from './ShapeGraphic.vue';

export default {
  name: 'ToolMenu',
  components: { ToolIcon, ShapeGraphic },
  props: {
    icon: { type: String, required: true },
    title: { type: String, default: '' },
    active: { type: Boolean, default: false },
    items: { type: Array, required: true }, // [{ value, label, ann?, icon?, w?, h? }]
    current: { type: String, default: '' },
  },
  emits: ['select'],
  data() {
    return { open: false, pos: { left: 0, top: 0 } };
  },
  computed: {
    panelStyle() {
      return { left: this.pos.left + 'px', top: this.pos.top + 'px' };
    },
  },
  beforeUnmount() {
    this.unbind();
  },
  methods: {
    toggle() {
      if (this.open) return this.close();
      const r = this.$refs.trigger.getBoundingClientRect();
      this.pos = { left: Math.max(8, Math.min(r.left, window.innerWidth - 190)), top: r.bottom + 6 };
      this.open = true;
      setTimeout(() => {
        document.addEventListener('pointerdown', this.onOutside, true);
        document.addEventListener('keydown', this.onKey);
      });
    },
    close() {
      this.open = false;
      this.unbind();
    },
    unbind() {
      document.removeEventListener('pointerdown', this.onOutside, true);
      document.removeEventListener('keydown', this.onKey);
    },
    onOutside(e) {
      if (this.$refs.panel?.contains(e.target) || this.$refs.trigger?.contains(e.target)) return;
      this.close();
    },
    onKey(e) {
      if (e.key === 'Escape') this.close();
    },
    pick(item) {
      this.$emit('select', item.value);
      this.close();
    },
  },
};
</script>

<style>
/* Non scopé : le panneau est téléporté dans <body> */
.tm-panel {
  position: fixed;
  z-index: 2000;
  min-width: 170px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
}
.tm-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  border: none;
  color: #e2e8f0;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
}
.tm-item:hover { background: #334155; }
.tm-item.current { background: rgba(37, 99, 235, 0.35); }
.tm-preview {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.tm-trigger .tm-caret { font-size: 9px; margin-left: 2px; opacity: 0.8; }
.tm-trigger { gap: 0; }
</style>
