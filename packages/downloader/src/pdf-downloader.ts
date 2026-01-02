import { $ } from 'bun';
import path from 'path';
import type {
  IDownloader,
  IPDFGenerator,
  ManhwaChapter,
  PDFDownloadOptions,
  PDFDownloadResult,
} from '@manverse/core';
import { PDFDownloaderConstants } from './constants.ts';

/**
 * PDFDownloader orchestrates downloading images to a temp directory,
 * generating a PDF, and cleaning up temporary files.
 *
 * Parallel downloads are supported - each chapter gets its own temp directory.
 */
export class PDFDownloader implements IDownloader {
  constructor(
    private imageDownloader: IDownloader,
    private pdfGenerator: IPDFGenerator,
  ) {}

  async downloadChapter(
    chapter: ManhwaChapter,
    options: PDFDownloadOptions,
  ): Promise<PDFDownloadResult> {
    const startTime = Date.now();

    // 0. Check if PDF already exists (Duplicate Checker)
    const expectedPdfPath = options.path.endsWith(PDFDownloaderConstants.PDF_EXTENSION)
      ? options.path
      : `${options.path}${PDFDownloaderConstants.PDF_EXTENSION}`;

    // Using Bun's synchronous check for simplicity since we want to fail fast/skip fast
    // const exists = await Bun.file(expectedPdfPath).exists(); // async way
    // But since we are inside an async function:
    const file = Bun.file(expectedPdfPath);
    if ((await file.exists()) && !options.force) {
      // Return success immediately with existing path
      // We return empty files/errors since we skipped download
      return {
        success: true,
        files: [],
        errors: [],
        timeTakenMs: 0,
        pdfPath: expectedPdfPath,
      };
    }

    // 1. Setup unique temp directory for this chapter
    // Using timestamp to ensure uniqueness for parallel downloads
    const tempId = `${Date.now()}-${Math.random().toString(36).substring(PDFDownloaderConstants.TEMP_ID_LENGTH)}`;
    const tempDir = path.join(options.path, PDFDownloaderConstants.TEMP_DIR_NAME, tempId);

    // 2. Download images to temp directory
    const downloadResult = await this.imageDownloader.downloadChapter(chapter, {
      ...options,
      path: tempDir,
    });

    if (!downloadResult.success) {
      // If download failed, still try to cleanup
      try {
        await $`rm -rf ${tempDir}`.quiet();
      } catch {
        // Ignore cleanup errors
      }

      return {
        ...downloadResult,
        pdfPath: '',
        timeTakenMs: Date.now() - startTime,
      };
    }

    // 3. Ensure output directory exists
    await $`mkdir -p "${options.path}"`;

    // 4. Generate PDF (use .pdf extension if not already present)
    const pdfPath = options.path.endsWith(PDFDownloaderConstants.PDF_EXTENSION)
      ? options.path
      : `${options.path}${PDFDownloaderConstants.PDF_EXTENSION}`;

    try {
      await this.pdfGenerator.generate(downloadResult.files, pdfPath);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('PDF generation failed');

      // Cleanup temp files on error
      try {
        await $`rm -rf ${tempDir}`.quiet();
      } catch {
        // Ignore cleanup errors
      }

      return {
        ...downloadResult,
        success: false,
        errors: [...downloadResult.errors, err],
        pdfPath: '',
        timeTakenMs: Date.now() - startTime,
      };
    }

    // 5. Cleanup temp directory (unless keepImages is true)
    if (!options.keepImages) {
      try {
        await $`rm -rf ${tempDir}`.quiet();
      } catch (error) {
        console.warn('Failed to cleanup temp directory:', error);
        // Don't fail the whole operation if cleanup fails
      }
    }

    return {
      ...downloadResult,
      pdfPath,
      timeTakenMs: Date.now() - startTime,
    };
  }
}
