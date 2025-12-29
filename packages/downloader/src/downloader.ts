import fs from 'fs';
import path from 'path';
import axios, { AxiosError } from 'axios';
import pLimit from 'p-limit';
import {
  type IDownloader,
  type DownloadOptions,
  type DownloadResult,
  type ManhwaChapter,
} from '@manverse/core';

export class FileSystemDownloader implements IDownloader {
  async downloadChapter(chapter: ManhwaChapter, options: DownloadOptions): Promise<DownloadResult> {
    const { path: outputDir, concurrency = 5, headers = {}, onProgress } = options;
    const errors: Error[] = [];
    const downloadedFiles: string[] = [];
    const startTime = Date.now();

    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const limit = pLimit(concurrency);
    let completed = 0;
    const total = chapter.length;

    // Report initial progress
    onProgress?.({ total, current: 0 });

    const tasks = chapter.map((item, index) =>
      limit(async () => {
        try {
          // Determine extension from URL or fallback to .jpg
          // item.img usually looks like ".../image.webp" or ".../image.jpg"
          const urlExt = path.extname(new URL(item.img).pathname) || '.jpg';
          const fileName = `${(index + 1).toString().padStart(3, '0')}${urlExt}`;
          const filePath = path.join(outputDir, fileName);

          // Prepare headers: Global headers + Item-specific headers (Referer)
          const requestHeaders = {
            ...headers,
            ...(item.headerForImage ? { Referer: item.headerForImage } : {}),
            'User-Agent':
              headers['User-Agent'] ||
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          };

          await this.downloadFile(item.img, filePath, requestHeaders);

          downloadedFiles.push(filePath);
          completed++;
          onProgress?.({
            total,
            current: completed,
            currentFile: fileName,
          });
        } catch (error) {
          const err = error instanceof Error ? error : new Error(`Failed to download ${item.img}`);
          errors.push(err);
        }
      }),
    );

    // Wait for all downloads to finish
    await Promise.all(tasks);

    // Sort files to ensure order (since parallelism might finish out of order)
    // We trust that filenames are "001.ext", "002.ext" so they sort alphabetically correctly
    downloadedFiles.sort();

    return {
      success: errors.length === 0,
      files: downloadedFiles,
      errors,
      timeTakenMs: Date.now() - startTime,
    };
  }

  private async downloadFile(
    url: string,
    dest: string,
    headers: Record<string, string>,
  ): Promise<void> {
    const writer = fs.createWriteStream(dest);

    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      headers,
      timeout: 30000, // 30s timeout per image
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', (err) => {
        // Cleanup partial file on error
        writer.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
    });
  }
}
