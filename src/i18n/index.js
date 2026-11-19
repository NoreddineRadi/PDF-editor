import { ref } from 'vue';
import { resolveRoute, pagePath, LOCALES, DEFAULT_LOCALE } from '../seo/routes.js';
import fr from './messages/fr.js';
import en from './messages/en.js';
import nl from './messages/nl.js';

const MESSAGES = { fr, en, nl };

const initial =
  typeof window !== 'undefined' ? resolveRoute(window.location.pathname) : { locale: DEFAULT_LOCALE, id: 'home' };

/** Langue et page courantes, déduites de l'URL (les pages statiques portent la langue dans leur chemin). */
export const locale = ref(initial.locale);
export const pageId = initial.id;

if (typeof document !== 'undefined') document.documentElement.lang = initial.locale;

/** Traduit une clé ; repli sur le français puis sur la clé elle-même. Variables : {n}. */
export function t(key, params) {
  const msg = MESSAGES[locale.value]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
  return params ? msg.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? '')) : msg;
}

/** Aller sur la même page dans une autre langue (navigation complète : c'est une page statique distincte). */
export function switchLocaleUrl(target) {
  return pagePath(target, pageId);
}

export const i18nPlugin = {
  install(app) {
    app.config.globalProperties.$t = t;
    app.config.globalProperties.$locale = locale;
  },
};

export { LOCALES };
