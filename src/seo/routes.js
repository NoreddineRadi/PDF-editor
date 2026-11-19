/**
 * Routes publiques : une page statique par fonctionnalité ET par langue.
 * Module pur, sans dépendance : utilisé à la fois par l'application (sélecteur de langue)
 * et par le plugin de pré-rendu exécuté sous Node au moment du build.
 *
 * Français = langue par défaut, sans préfixe (/signer-pdf/) ; EN -> /en/sign-pdf/ ; NL -> /nl/pdf-ondertekenen/
 */
export const LOCALES = ['fr', 'en', 'nl'];
export const DEFAULT_LOCALE = 'fr';
export const OG_LOCALE = { fr: 'fr_FR', en: 'en_US', nl: 'nl_NL' };
export const LOCALE_NAMES = { fr: 'Français', en: 'English', nl: 'Nederlands' };

export const PAGES = [
  { id: 'home', slugs: { fr: '', en: '', nl: '' } },
  { id: 'edit', slugs: { fr: 'modifier-pdf', en: 'edit-pdf', nl: 'pdf-bewerken' } },
  { id: 'sign', slugs: { fr: 'signer-pdf', en: 'sign-pdf', nl: 'pdf-ondertekenen' } },
  { id: 'merge', slugs: { fr: 'fusionner-pdf', en: 'merge-pdf', nl: 'pdf-samenvoegen' } },
  { id: 'extract', slugs: { fr: 'extraire-pages-pdf', en: 'extract-pdf-pages', nl: 'pdf-paginas-extraheren' } },
  { id: 'rotate', slugs: { fr: 'pivoter-pdf', en: 'rotate-pdf', nl: 'pdf-roteren' } },
  { id: 'reorder', slugs: { fr: 'reorganiser-pages-pdf', en: 'reorder-pdf-pages', nl: 'pdf-paginas-ordenen' } },
  { id: 'text', slugs: { fr: 'ajouter-texte-pdf', en: 'add-text-to-pdf', nl: 'tekst-toevoegen-aan-pdf' } },
  { id: 'image', slugs: { fr: 'ajouter-image-pdf', en: 'add-image-to-pdf', nl: 'afbeelding-toevoegen-aan-pdf' } },
  { id: 'annotate', slugs: { fr: 'annoter-pdf', en: 'annotate-pdf', nl: 'pdf-annoteren' } },
  { id: 'whiteout', slugs: { fr: 'effacer-texte-pdf', en: 'erase-text-in-pdf', nl: 'tekst-wissen-in-pdf' } },
  { id: 'privacy', slugs: { fr: 'confidentialite', en: 'privacy', nl: 'privacy' } },
];

/** Chemin public d'une page : toujours avec "/" final (le serveur sert le index.html du dossier). */
export function pagePath(locale, id) {
  const page = PAGES.find((p) => p.id === id) || PAGES[0];
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  const slug = page.slugs[locale] ?? '';
  return slug ? `${prefix}/${slug}/` : `${prefix}/`;
}

/** Inverse : { locale, id } à partir d'un chemin (tolère /index.html et l'absence de "/" final). */
export function resolveRoute(pathname = '/') {
  const clean = String(pathname || '/').split(/[?#]/)[0].replace(/index\.html$/, '');
  const parts = clean.split('/').filter(Boolean);
  let locale = DEFAULT_LOCALE;
  if (parts.length && LOCALES.includes(parts[0]) && parts[0] !== DEFAULT_LOCALE) locale = parts.shift();
  const slug = parts[0] || '';
  const page = PAGES.find((p) => p.slugs[locale] === slug);
  return { locale, id: page ? page.id : 'home' };
}
