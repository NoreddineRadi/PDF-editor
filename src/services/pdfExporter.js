import { PDFDocument, rgb } from 'pdf-lib';

export default {
  async exportModifiedPdf(originalPdfBytes, annotationsByPage) {
    // 1. Charger le PDF d'origine avec pdf-lib
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    const pages = pdfDoc.getPages();

    // 2. Parcourir les annotations page par page
    for (const [pageIndexStr, annotations] of Object.entries(annotationsByPage)) {
      const pageIndex = parseInt(pageIndexStr, 10);
      if (pageIndex < 0 || pageIndex >= pages.length) continue;

      const page = pages[pageIndex];
      const { width: pageWidth, height: pageHeight } = page.getSize();

      for (const ann of annotations) {
        // Coordonnées et styles (à adapter selon la structure de votre store d'annotations)
        const { x, y, type, content, color, fontSize, dataUrl } = ann;

        // Note : pdf-lib utilise un repère (0,0) en BAS à gauche, 
        // tandis que le web utilise souvent le HAUT à gauche. Il faut parfois inverser Y : 
        // const pdfY = pageHeight - y;

        if (type === 'text') {
          // Ajouter du texte
          page.drawText(content || '', {
            x: x,
            y: pageHeight - y, // Conversion repère web -> pdf-lib
            size: fontSize || 12,
            color: color ? rgb(color.r, color.g, color.b) : rgb(0, 0, 0),
          });
        } 
        else if (type === 'signature' && dataUrl) {
          // Incruster une signature (image PNG en base64)
          const pngImageBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
          const pngImage = await pdfDoc.embedPng(pngImageBytes);
          
          page.drawImage(pngImage, {
            x: x,
            y: pageHeight - y - (ann.height || 50),
            width: ann.width || 150,
            height: ann.height || 50,
          });
        }
        // Vous pouvez ajouter d'autres types (rectangles, dessins libres, etc.) ici
      }
    }

    // 3. Générer le fichier PDF final modifié
    const modifiedPdfBytes = await pdfDoc.save();
    return modifiedPdfBytes;
  },

  // Utilitaire pour déclencher le téléchargement dans le navigateur
  downloadBlob(pdfBytes, filename = 'document-modifie.pdf') {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }
};