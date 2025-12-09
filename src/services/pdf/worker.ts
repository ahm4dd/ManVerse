import PDFDocument from 'pdfkit';
import fs from 'fs';
import sharp from 'sharp';

export async function convertWebPToPdf(webpFiles: string[], outputPath: string) {
    // Initialize PDF with 'autoFirstPage: false'
    // We do this so we can set the page size dynamically for the first image later
    const doc = new PDFDocument({ autoFirstPage: false });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    console.log(`Starting conversion for ${webpFiles.length} files...`);

    for (const filePath of webpFiles) {
        try {
            // Process image with Sharp
            // This gets the Width/Height and ensures the buffer is PDF-friendly
            const imagePipeline = sharp(filePath);
            const metadata = await imagePipeline.metadata();
            
            // We convert to PNG buffer in memory. 
            // PDFKit handles PNGs perfectly, whereas direct WebP support can be flaky with transparency.
            const imageBuffer = await imagePipeline.toFormat('png').toBuffer();

            // Add a page with the EXACT dimensions of the image
            // margin: 0 removes white borders
            doc.addPage({
                size: [metadata.width, metadata.height],
                margin: 0
            });

            // Place the image filling the entire page
            doc.image(imageBuffer, 0, 0, {
                width: metadata.width,
                height: metadata.height
            });

            console.log(`Processed: ${filePath}`);

        } catch (error: unknown) {
            console.error(`Error processing image ${filePath}:`, error);
        }
    }

    doc.end();

    // Wait for the file to finish writing
    stream.on('finish', () => {
        console.log(`Success! PDF saved to: ${outputPath}`);
    });
}