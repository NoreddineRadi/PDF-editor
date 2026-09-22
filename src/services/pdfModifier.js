import { PDFDocument, degrees } from 'pdf-lib';

export default {
  /**
   * Applique la réorganisation et les rotations aux octets originaux
   * @param {Uint8Array} originalBytes 
   * @param {Object} options 
   * @returns {Promise<Uint8Array>}
   */
  async applyTransforms(originalBytes, { pagesOrder, rotationMap }) {
    const srcDoc = await PDFDocument.load(originalBytes);
    const newDoc = await PDFDocument.create();

    // Réorganiser et copier les pages
    const copiedPages = await newDoc.copyPages(srcDoc, pagesOrder);

    copiedPages.forEach((page, newIndex) => {
      const originalIndex = pagesOrder[newIndex];
      const additionalRotation = rotationMap[originalIndex] || 0;
      
      if (additionalRotation !== 0) {
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees((currentRotation + additionalRotation) % 360));
      }
      
      newDoc.addPage(page);
    });

    return await newDoc.save();
  }
};