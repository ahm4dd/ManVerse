// New interface-based generator
export { PDFKitGenerator } from './generator';

// Legacy function for backward compatibility
import PDFDocument from 'pdfkit';
import sharp from 'sharp';

/** @deprecated Use PDFKitGenerator class instead */
export async function convertWebPToPdf(webpFiles: string[], outputPath: string) {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ autoFirstPage: false });

  // Collect PDF chunks
  doc.on('data', (chunk) => chunks.push(chunk));

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

  // Wait for completion and write with Bun
  await new Promise<void>((resolve) => {
    doc.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      await Bun.write(outputPath, buffer);
      console.log(`Success! PDF saved to: ${outputPath}`);
      resolve();
    });
  });
}
