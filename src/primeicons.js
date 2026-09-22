import {
  CloudUpload,
  FilePdf,
  Plus,
  Trash,
  ChevronLeft,
  ChevronRight,
  Minus,
  Refresh,
  Download,
  FolderOpen,
  FileExport,
  Check,
  Times,
  Pencil,
  FileEdit,
  Palette,
  Undo,
  Sparkles,
} from '@primeicons/vue';

export function installPrimeIcons(app) {
  app
    .component('CloudUpload', CloudUpload)
    .component('FilePdf', FilePdf)
    .component('Plus', Plus)
    .component('Trash', Trash)
    .component('ChevronLeft', ChevronLeft)
    .component('ChevronRight', ChevronRight)
    .component('Minus', Minus)
    .component('Refresh', Refresh)
    .component('Download', Download)
    .component('FolderOpen', FolderOpen)
    .component('FileExport', FileExport)
    .component('Check', Check)
    .component('Times', Times)
    .component('Pencil', Pencil)
    .component('FileEdit', FileEdit)
    .component('Palette', Palette)
    .component('Undo', Undo)
    .component('Sparkles', Sparkles);
}