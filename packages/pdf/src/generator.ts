import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import type { IPDFGenerator } from '@manverse/core';

export class PDFKitGenerator implements IPDFGenerator {
  async generate(imagePaths: string[], outputPath: string): Promise<void> {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ autoFirstPage: false });

    // Collect PDF chunks in memory
    doc.on('data', (chunk) => chunks.push(chunk));

    // Process images sequentially
    await this.processImages(doc, imagePaths);

    // Finalize document
    doc.end();

    // Wait for PDF generation to complete
    await new Promise<void>((resolve, reject) => {
      doc.on('end', () => resolve());
      doc.on('error', (err: Error) => reject(err));
    });

    // Write to file using Bun's native API
    const buffer = Buffer.concat(chunks);
    await Bun.write(outputPath, buffer);
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
