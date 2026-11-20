<template>
  <div class="donate-menu">
    <button
      ref="trigger"
      class="donate-link"
      :aria-expanded="open"
      :title="$t('tb.donateTip')"
      @click="toggle"
    >♥ <span class="btn-label">{{ $t('tb.donate') }}</span></button>

    <!-- Téléporté dans <body> : la barre d'outils défile horizontalement et rognerait le panneau -->
    <Teleport to="body">
      <div v-if="open" ref="panel" class="donate-panel" :style="panelStyle" @pointerdown.stop>
        <DonateCard />
      </div>
    </Teleport>
  </div>
</template>

<script>
import DonateCard from './DonateCard.vue';

export default {
  name: 'DonateMenu',
  components: { DonateCard },
  data() {
    return { open: false, pos: { right: 8, top: 0 } };
  },
  computed: {
    panelStyle() {
      return { right: this.pos.right + 'px', top: this.pos.top + 'px' };
    },
  },
  beforeUnmount() {
    this.unbind();
  },
  methods: {
    toggle() {
      if (this.open) return this.close();
      const r = this.$refs.trigger.getBoundingClientRect();
      this.pos = { right: Math.max(8, window.innerWidth - r.right), top: r.bottom + 6 };
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
  },
};
</script>

<style>
/* Non scopé : le panneau est téléporté dans <body> */
.donate-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 30px;
  padding: 0 10px;
  background: transparent;
  border: 1px solid #475569;
  border-radius: 6px;
  color: #f9a8d4;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.donate-link:hover { background: #1e293b; }
.donate-panel {
  position: fixed;
  z-index: 2000;
  width: min(440px, calc(100vw - 16px));
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
  border-radius: 12px;
}
.donate-panel .donate-card { max-width: none; }
</style>
