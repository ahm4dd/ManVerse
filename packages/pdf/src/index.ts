// New interface-based generator
export { PDFKitGenerator } from './generator.ts';

// Legacy function for backward compatibility
import PDFDocument from 'pdfkit';
import fs from 'fs';
import sharp from 'sharp';

/** @deprecated Use PDFKitGenerator class instead */
export async function convertWebPToPdf(webpFiles: string[], outputPath: string) {
  // Initialize PDF with 'autoFirstPage: false' to set dynamic page sizes
  const doc = new PDFDocument({ autoFirstPage: false });
  const stream = fs.createWriteStream(outputPath);

  doc.pipe(stream);

  console.log(`Starting conversion for ${webpFiles.length} files...`);

  for (const filePath of webpFiles) {
    try {
      const imagePipeline = sharp(filePath);
      const metadata = await imagePipeline.metadata();

      // Convert to PNG buffer as PDFKit handles PNGs better than WebP
      const imageBuffer = await imagePipeline.toFormat('png').toBuffer();

      doc.addPage({
        size: [metadata.width, metadata.height],
        margin: 0,
      });

      doc.image(imageBuffer, 0, 0, {
        width: metadata.width,
        height: metadata.height,
      });

      console.log(`Processed: ${filePath}`);
    } catch (error: unknown) {
      console.error(`Error processing image ${filePath}:`, error);
    }
  }

  doc.end();

  stream.on('finish', () => {
    console.log(`Success! PDF saved to: ${outputPath}`);
  });
}
