import * as PrimeIcons from '@primeicons/vue';

// Icônes utilisées dans les templates (enregistrées globalement sous le même nom)
const ICON_NAMES = [
  'CloudUpload',
  'FilePdf',
  'Plus',
  'Trash',
  'ChevronLeft',
  'ChevronRight',
  'Minus',
  'Refresh',
  'Download',
  'FolderOpen',
  'FileExport',
  'Check',
  'Times',
  'Pencil',
  'FileEdit',
  'Palette',
  'Undo',
  'Sparkles',
];

export function installPrimeIcons(app) {
  for (const name of ICON_NAMES) {
    const icon = PrimeIcons[name];
    if (icon) {
      app.component(name, icon);
    } else {
      // Un nom d'icône inexistant ne doit pas casser tout le build : on prévient dans la console
      console.warn(`[primeicons] Icône introuvable dans @primeicons/vue : "${name}"`);
    }
  }
}
