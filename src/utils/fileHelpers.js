/** Génère un identifiant court et unique */
export function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

/** Déclenche le téléchargement d'un fichier généré dans le navigateur */
export function downloadBlob(bytes, filename, mime = 'application/pdf') {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Ne pas révoquer immédiatement : Firefox/Safari peuvent annuler le téléchargement
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Convertit une data URL (base64) en Uint8Array */
export function dataUrlToBytes(dataUrl) {
  const base64 = String(dataUrl).split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
