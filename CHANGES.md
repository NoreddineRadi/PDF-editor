# Lot 4 : déploiement en sous-dossier et don PayPal (QR code)

- **Correctif 404 /manifest.webmanifest** : tous les chemins racine (manifest, favicon, apple-touch-icon, liens internes des pages SEO) passent par une base unique (`normalizeBase` / `withBase`), déduite de `siteUrl` si `VITE_BASE_URL` manque. Le manifest est généré avec `start_url`, `scope` et icônes préfixés.
- `resolveRoute` ne dépend plus de `import.meta.env` (tests Node à nouveau valides) et ne retire que le préfixe en tête de chemin.
- **Don PayPal** : `DonateCard` (QR + bouton, masqué sur mobile), panneau ♥ dans l'en-tête, carte compacte sur l'écran d'accueil, section pré-rendue sur les 36 pages SEO. QR généré localement, validé par un décodeur (81 cas).
- Tests : `yarn test` (5 fichiers).

# Lot 3 : SEO, multilingue (FR / EN / NL), signature multi-pages, performance

- **Pages statiques par fonctionnalité et par langue** (36 pages : modifier, signer, fusionner, extraire, pivoter, réorganiser, ajouter texte / image, annoter, effacer, confidentialité), générées par `yarn build` (plugin `build/seoPlugin.js`) avec titres, descriptions, canonical, hreflang, Open Graph, JSON-LD, `sitemap.xml`, `robots.txt`. Voir `SEO.md`.
- **Interface en 3 langues** (`src/i18n`), langue déduite de l'URL, sélecteur dans l'en-tête.
- **Signature** : appliquer à la page courante, à toutes les pages ou à une plage (`1-3, 5`), en une seule étape d'annulation.
- **Performance** : pdf.js, pdf-lib et la fenêtre de signature chargés à la demande ; `dvh` mobile ; contenu éditorial en `content-visibility:auto`.
- **Dons PayPal facultatifs** (`site.config.js`), vérification Search Console / Bing par balise meta.
- Tests : `yarn test` (4 fichiers).

# Lot 2B : formes, symboles, duplication, calques

- **Formes** (menu ▾ de la barre) : rectangle, carré, cercle, triangle, ligne droite ; couleur, épaisseur, remplissage optionnel. Glisser pour tracer, ou un clic pour une taille par défaut. Redimensionnables et pivotables comme le texte.
- **Symboles** : case cochée / décochée, radio coché / décoché, coche ✓, puce •. Un clic pose le symbole (l'outil reste armé, Échap pour quitter).
- **Export** : formes et symboles sont gravés en vectoriel (chemins PDF, Béziers pour les cercles), rotation de l'élément et de la page comprises. Une seule définition (`src/utils/shapeDefs.js`) sert à l'affichage et à l'export.
- **Duplication** (Ctrl+D ou bouton), **premier plan / arrière-plan** (boutons de la barre flottante), **flèches** pour déplacer l'élément sélectionné (Maj = 10 px).
- Tests : `yarn test` (32 tests).

# PDF Studio : correctifs appliqués

Ces fichiers conservent les mêmes chemins que dans votre dépôt : copiez-les par-dessus les vôtres.

## 1. Étapes à faire de votre côté

1. **Supprimer** les fichiers devenus inutiles :
   `src/services/pdfModifier.js`, `src/primevue.js`, `src/components/editor/PageCard.vue`,
   `src/stores/toolStore.js`, `src/router/index.js`, `yarn.lock1`
2. **Régénérer `yarn.lock`** (indispensable : la CI utilise `yarn install --immutable`, elle échouera sinon) :
   ```
   yarn install
   git add package.json yarn.lock
   ```
   Retirés de `package.json` : `jspdf`, `vue-router`, `vue-draggable-plus`, `install`, `npm`.
3. **Licence PrimeVue** : si `.env` est déjà versionné, exécutez `git rm --cached .env`.
   Cette clé est de toute façon visible dans le JS public (variable `VITE_*`). Si vous voulez qu'elle reste privée,
   régénérez-la. Ajoutez-la ensuite en variable CI/CD `VITE_PRIMEVUE_LICENCE`.
4. **CI** : créez les variables `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS` (sortie de `ssh-keyscan`, vérifiée une fois à la main)
   et `VPS_USER` (`utilisateur@hôte`). Le mot de passe `VPS_PASSWORD` n'est plus utilisé : supprimez-le.
5. Lancer `yarn dev` et tester (voir la liste en fin de document).

## 2. Corrections par fichier

| Fichier | Correction |
|---|---|
| `services/pdfExporter.js` | Remplace l'ancien fichier jamais utilisé et porte désormais tout l'export. Dessin et surligneur convertis de la grille 0–1000 vers les points PDF. Signature : utilise `width`/`height` et conserve les proportions. Texte : retour à la ligne, police, zoom. Rotation native + utilisateur prise en compte. CropBox gérée. Caractères non encodables remplacés par `?`. Une annotation en échec n'annule plus l'export. |
| `utils/pdfGeometry.js` (nouveau) | Conversion repère affiché → repère PDF pour 0/90/180/270°. Testé. |
| `stores/pdfStore.js` | Doublons supprimés (`activeTool`, `strokeWidth`, `setAnnotationColor`) ainsi que l'état inutilisé. `markRaw` sur le document PDF.js. Import fichier par fichier avec gestion des erreurs et des PDF protégés. Page courante conservée par identifiant après tri/suppression. Documents orphelins détruits. Notifications au lieu de `alert()`. Zoom borné. |
| `services/pdfReader.js` | Rotation native ajoutée à celle de l'utilisateur. Rendu hors-écran sans scintillement, avec `devicePixelRatio` (net sur Retina) et sans conflit « même canvas ». |
| `PdfViewer.vue` | `viewportWidth/Height` enfin définis. Re-rendu à chaque changement de page ou de rotation. Centrage qui ne rogne plus les grandes pages. Import `.pdf` aussi sans type MIME. |
| `AppSidebar.vue` | Le repli fonctionne (`min-width`). Contrastes corrigés sur fond sombre. |
| `ThumbnailCard.vue` | Rendu paresseux (IntersectionObserver), annulation des rendus, plus de `watch` profond. |
| `AnnotationLayer.vue` | Épaisseur de trait proportionnelle au zoom (identique à l'export). Texte vide supprimé à la désélection. Scroll tactile libre hors mode dessin. Ancien watcher profond retiré. |
| `TextAnnotationOverlay.vue` | Taille en points × zoom, padding proportionnel, hauteur initiale suffisante, plus de minimum en pixels. Nettoyage des écouteurs. `rows` corrigé. |
| `SignatureAnnotationOverlay.vue` | Plus de minimum en pixels. Nettoyage des écouteurs. |
| `SignatureModal.vue` | Signature recadrée et plus nette (×2). Coordonnées corrigées si le canvas est redimensionné par le CSS. Mise en page sans classes PrimeFlex. |
| `AppToolbar.vue` | Boutons de zoom ajoutés (`setZoom` n'existait pas). Bloc vide supprimé. |
| `App.vue`, `main.js` | Toasts (`ToastService`). Écouteur `wheel` nettoyé. |
| `vite.config.js` | `manualChunks` ne capture plus `vuedraggable` dans le chunk Vue. |
| `.gitignore`, `.env.example` | `.env` ignoré. |
| `.gitlab-ci.yml` | Clé SSH + empreinte d'hôte épinglée, `rsync --delete`, `rules:`. |

## 3. Point découvert pendant les corrections

Le projet utilise des classes **PrimeFlex** (`flex`, `gap-2`, `justify-content-between`, `shadow-3`, `mt-4`…) alors que
`primeflex` n'est pas installé. Elles ne faisaient rien (pied de la modale de signature mal aligné, ombres absentes).
Je les ai remplacées par du CSS local plutôt que d'ajouter une dépendance.

## 4. Non vérifié

Les dépendances n'ont pas pu être installées dans mon environnement (pas d'accès réseau), donc ni `yarn build` ni test
dans un navigateur. Vérifié : syntaxe de tous les fichiers JS/Vue, et conversion de coordonnées pour les 4 rotations.

À tester chez vous :
- [ ] Dessin + surligneur + texte + signature exportés au bon endroit (rotation 0°)
- [ ] Même test après rotation de la page (90° / 180° / 270°)
- [ ] PDF avec `/Rotate` natif : affichage identique à l'export
- [ ] Redimensionner une signature puis exporter
- [ ] Texte multi-ligne et accentué, taille changée, zoom ≠ 100 %
- [ ] Repli de la sidebar, glisser-déposer de pages, suppression de la page courante
- [ ] Import d'un PDF protégé par mot de passe (message d'erreur attendu)
- [ ] `yarn build` puis déploiement CI

Limite connue : le texte exporté utilise Helvetica. Les caractères hors alphabet latin sont remplacés par `?`.
