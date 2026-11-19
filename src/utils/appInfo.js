/**
 * Informations de version affichées dans l'interface.
 * Les valeurs sont injectées au build par vite.config.js (define) :
 *   - version : champ "version" de package.json
 *   - commit  : GITHUB_SHA / CI_COMMIT_SHA en CI, sinon `git rev-parse` en local, sinon "dev"
 *   - date    : horodatage du build (ISO)
 */
/* global __APP_VERSION__, __APP_COMMIT__, __BUILD_DATE__, __DONATE_URL__ */
/** URL externe acceptée seulement en https (liens de don configurés par variable d'environnement). */
export function safeExternalUrl(value) {
  try {
    const u = new URL(String(value || ''));
    return u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

export const appInfo = {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
  commit: typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : 'dev',
  buildDate: typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '',
  // Lien de don facultatif (site.config.js / VITE_PAYPAL_URL) ; vide = aucun bouton
  donateUrl: typeof __DONATE_URL__ !== 'undefined' ? safeExternalUrl(__DONATE_URL__) : '',
};

/** Texte de l'info-bulle : « Version 0.1.0 · commit a1b2c3d · build du 18/11/2026 09:24 » */
export function describeBuild(info = appInfo) {
  const parts = [`Version ${info.version}`, `commit ${info.commit}`];
  if (info.buildDate) {
    const d = new Date(info.buildDate);
    if (!Number.isNaN(d.getTime())) {
      parts.push(`build du ${d.toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' })}`);
    }
  }
  return parts.join(' · ');
}
