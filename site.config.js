/**
 * Réglages PUBLICS du site (rien de secret ici : ces valeurs finissent dans le HTML généré).
 * Ils sont committés pour que la CI actuelle (GitHub Actions) les prenne en compte sans modifier le workflow.
 * Chaque valeur peut aussi être surchargée par une variable d'environnement au moment du build.
 */
export default {
  // Adresse publique du site, sans "/" final. OBLIGATOIRE pour : canonical, hreflang, sitemap.xml, Open Graph.
  // Exemple : 'https://pdf.mondomaine.com'   (variable : VITE_SITE_URL)
  siteUrl: 'https://free-apps.duckdns.org/pdf-editor',

  // Dossier de déploiement ('/pdf-editor/'). Laisser vide : il est déduit de siteUrl ci-dessus (variable : VITE_BASE_URL).
  baseUrl: '',

  // Lien de don PayPal (facultatif ; https obligatoire). Vide = aucun bouton de don affiché.
  // Exemples : 'https://paypal.me/monpseudo'  ou  'https://www.paypal.com/donate/?hosted_button_id=XXXX'   (variable : VITE_PAYPAL_URL)
  paypalUrl: '',

  // Codes de vérification Search Console / Bing Webmaster (la valeur "content" de la balise meta fournie)
  googleSiteVerification: '', // VITE_GOOGLE_SITE_VERIFICATION
  bingSiteVerification: '', //   VITE_BING_SITE_VERIFICATION
};
