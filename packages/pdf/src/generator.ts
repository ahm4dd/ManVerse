import PDFDocument from 'pdfkit';
import fs from 'fs';
import sharp from 'sharp';
import pLimit from 'p-limit';
import type { IPDFGenerator } from '@manverse/core';
import { PDFConstants } from './constants.ts';

export class PDFKitGenerator implements IPDFGenerator {
  async generate(imagePaths: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Initialize PDF with 'autoFirstPage: false' to set dynamic page sizes
      const doc = new PDFDocument({ autoFirstPage: false });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // Process images in batches to optimize speed while managing memory
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
    // Concurrency limit for image conversion
    const limit = pLimit(PDFConstants.CONCURRENCY);

    // Process in batches to ensure order is maintained in PDF
    // We fetch a batch of buffers in parallel, then add them sequentially
    for (let i = 0; i < imagePaths.length; i += PDFConstants.BATCH_SIZE) {
      const batchPaths = imagePaths.slice(i, i + PDFConstants.BATCH_SIZE);

      // Convert batch to buffers in parallel
      const bufferPromises = batchPaths.map((filePath) =>
        limit(async () => {
          try {
            const imagePipeline = sharp(filePath);
            const metadata = await imagePipeline.metadata();

            // Convert to PNG buffer as PDFKit handles PNGs better than WebP
            const buffer = await imagePipeline.toFormat(PDFConstants.OUTPUT_FORMAT).toBuffer();

            return {
              buffer,
              width: metadata.width || 0,
              height: metadata.height || 0,
              path: filePath,
            };
          } catch (error) {
            console.error(`Error processing image ${filePath}:`, error);
            throw error;
          }
        }),
      );

      const processedImages = await Promise.all(bufferPromises);

      // Add pages to PDF sequentially to maintain order
      for (const img of processedImages) {
        if (img.width === 0 || img.height === 0) continue;

        doc.addPage({
          size: [img.width, img.height],
          margin: PDFConstants.DEFAULT_MARGIN,
        });

        doc.image(img.buffer, 0, 0, {
          width: img.width,
          height: img.height,
        });
      }
    }
  }
}
