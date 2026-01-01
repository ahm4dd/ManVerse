import PDFDocument from 'pdfkit';
import fs from 'fs';
import sharp from 'sharp';
import type { IPDFGenerator } from '@manverse/core';

export class PDFKitGenerator implements IPDFGenerator {
  async generate(imagePaths: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Initialize PDF with 'autoFirstPage: false' to set dynamic page sizes
      const doc = new PDFDocument({ autoFirstPage: false });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // Process images sequentially
      this.processImages(doc, imagePaths)
        .then(() => {
          doc.end();
        })
        .catch(reject);

      stream.on('finish', () => {
        resolve();
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  private async processImages(doc: PDFKit.PDFDocument, imagePaths: string[]): Promise<void> {
    for (const filePath of imagePaths) {
      try {
        const imagePipeline = sharp(filePath);
        const metadata = await imagePipeline.metadata();

        // Convert to PNG buffer as PDFKit handles PNGs better than WebP
        const imageBuffer = await imagePipeline.toFormat('png').toBuffer();

        doc.addPage({
          size: [metadata.width!, metadata.height!],
          margin: 0,
        });

        doc.image(imageBuffer, 0, 0, {
          width: metadata.width,
          height: metadata.height,
        });
      } catch (error: unknown) {
        console.error(`Error processing image ${filePath}:`, error);
        throw error;
      }
    }
  }
}
