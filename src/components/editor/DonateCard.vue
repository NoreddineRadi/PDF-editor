<template>
  <!-- Don facultatif : QR code (ordinateur) + bouton PayPal (toujours, indispensable sur mobile). Rien si aucun lien n'est configuré. -->
  <section v-if="url" class="donate-card" :class="{ compact }" :aria-label="$t('don.title')">
    <div v-if="qrSvg" class="dc-qr" v-html="qrSvg"></div>
    <div class="dc-body">
      <h3 class="dc-title">♥ {{ $t('don.title') }}</h3>
      <p class="dc-text">{{ $t('don.text') }}</p>
      <a class="dc-btn" :href="url" target="_blank" rel="noopener noreferrer nofollow">{{ $t('don.button') }}</a>
      <p v-if="qrSvg" class="dc-scan">{{ $t('don.scan') }}</p>
    </div>
  </section>
</template>

<script>
import { appInfo } from '@/utils/appInfo';
import { encodeQr, qrToSvg } from '@/utils/qrcode';

export default {
  name: 'DonateCard',
  props: { compact: { type: Boolean, default: false } },
  data() {
    return { url: appInfo.donateUrl };
  },
  computed: {
    // SVG généré localement (aucun service externe) à partir du lien configuré ; contenu maîtrisé, donc sûr pour v-html
    qrSvg() {
      if (!this.url) return '';
      try {
        return qrToSvg(encodeQr(this.url), { label: this.$t('don.qrAlt') });
      } catch {
        return ''; // lien trop long pour un QR : le bouton reste disponible
      }
    },
  },
};
</script>

<style scoped>
.donate-card {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  max-width: 440px;
  padding: 0.9rem 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  color: #334155;
  text-align: left;
}
.dc-qr {
  flex: none;
  width: 118px;
  height: 118px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.dc-qr :deep(svg) { display: block; width: 100%; height: 100%; }
.dc-title { margin: 0 0 0.25rem; font-size: 1rem; color: #0f172a; }
.dc-text { margin: 0 0 0.6rem; font-size: 0.85rem; line-height: 1.45; }
.dc-btn {
  display: inline-block;
  padding: 0.45rem 0.9rem;
  background: #0070ba;
  color: #fff;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
}
.dc-btn:hover { background: #005ea6; }
.dc-scan { margin: 0.5rem 0 0; font-size: 0.75rem; color: #64748b; }

.donate-card.compact { padding: 0.6rem 0.8rem; gap: 0.8rem; }
.compact .dc-qr { width: 84px; height: 84px; }
.compact .dc-text { display: none; }
.compact .dc-title { font-size: 0.9rem; }

/* Mobile / écran tactile : pas de QR (on ne peut pas se scanner soi-même), le bouton suffit */
@media (max-width: 640px), (pointer: coarse) {
  .dc-qr, .dc-scan { display: none; }
  .donate-card { max-width: 100%; }
  .dc-btn { display: block; text-align: center; }
}
</style>
