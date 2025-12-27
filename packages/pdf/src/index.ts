import PDFDocument from 'pdfkit';
import fs from 'fs';

/**
 * Shared PDF Conversion Logic
 */
export async function convertWebPToPdf(imagePaths: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    for (const imagePath of imagePaths) {
      doc.addPage();
      doc.image(imagePath, 0, 0);
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}
