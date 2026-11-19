# SEO, multilingue et suivi : mode d'emploi

## 1. À faire en premier : renseigner le domaine
Ouvrez **`site.config.js`** et saisissez `siteUrl` (ex. `https://pdf.mondomaine.com`, sans `/` final), puis committez.
Sans domaine, le build fonctionne mais : pas de `sitemap.xml`, canonical/hreflang relatifs (Google les ignore en partie).
Le build affiche `[seo] ⚠ siteUrl non renseigné` tant que ce n'est pas fait. (Variable `VITE_SITE_URL` possible aussi.)

## 2. Ce que génère `yarn build` (aucun changement de CI nécessaire)
- `dist/index.html` = accueil FR ; `dist/en/…`, `dist/nl/…` ; **36 pages** (12 pages x 3 langues), ex. `/signer-pdf/`, `/en/sign-pdf/`, `/nl/pdf-ondertekenen/`.
- Chaque page : `<title>`, description, canonical, hreflang (+ x-default), Open Graph / Twitter, JSON-LD (WebApplication gratuite, FAQPage, fil d'Ariane), contenu éditorial pré-rendu (h1, étapes, avantages, FAQ, liens vers les autres outils).
- `dist/sitemap.xml` (avec alternates hreflang) et `dist/robots.txt` (ligne `Sitemap:`).
- Les textes sont dans `src/seo/content/{fr,en,nl}.js`, les URL dans `src/seo/routes.js`. Pour ajouter une page : une entrée dans `PAGES` + le texte dans les 3 langues (`yarn test` vérifie la cohérence).

## 3. Serveur web (important)
Chaque page est un dossier avec `index.html`. Le serveur doit servir ces dossiers (nginx : `index index.html;` et `try_files $uri $uri/ /index.html;`). Redirigez `http -> https` et, si possible, `www -> sans www`. Activez gzip/brotli et un cache long sur `/assets/` (fichiers à hash).

## 4. Google Search Console et Bing Webmaster Tools
1. Search Console > Ajouter une propriété > « Préfixe d'URL » > méthode **balise HTML** : copiez la valeur `content` dans `googleSiteVerification` (`site.config.js`), redéployez, cliquez sur Valider.
2. Même chose sur Bing Webmaster Tools avec `bingSiteVerification` (ou « Importer depuis Google Search Console »).
3. Soumettez `https://votre-domaine/sitemap.xml` dans les deux outils.
4. Suivez : pages indexées, requêtes, Core Web Vitals (rapport « Expérience »). Comptez quelques jours à semaines pour l'indexation.

## 5. Dons (facultatifs)
`paypalUrl` dans `site.config.js` (https obligatoire, ex. `https://paypal.me/pseudo`). Vide = aucun bouton nulle part. Affiché : bouton ♥ discret dans l'en-tête et lien dans le pied de page des pages.

## 6. Confidentialité
Tout le traitement PDF se fait dans le navigateur ; aucun envoi, aucun cookie de suivi, aucun outil de mesure d'audience par défaut (page `/confidentialite/`). Si vous ajoutez des statistiques plus tard, mettez à jour cette page.

## 7. Langues de l'interface
Textes dans `src/i18n/messages/{fr,en,nl}.js` (même clés, vérifié par les tests). La langue vient de l'URL (`/en/…`, `/nl/…`) ; le sélecteur de l'en-tête recharge la page équivalente.
