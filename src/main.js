import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Aura from '@primeuix/themes/aura';

import Tooltip from 'primevue/tooltip';

import App from './App.vue';
import { installPrimeIcons } from './primeicons.js';
import { i18nPlugin } from './i18n/index.js';
import './assets/styles/main.css';

const app = createApp(App);
installPrimeIcons(app);
app.use(createPinia());
app.use(i18nPlugin);

app.use(PrimeVue, {
  theme: {
    preset: Aura
  },
  license: import.meta.env.VITE_PRIMEVUE_LICENCE
});
app.use(ToastService);

app.directive('tooltip', Tooltip);
app.mount('#app');
