import path from 'path';
import pLimit from 'p-limit';
import { $ } from 'bun';
import {
  type IDownloader,
  type DownloadOptions,
  type DownloadResult,
  type ManhwaChapter,
  ImageExtensions,
  defaultBrowserConfig,
} from '@manverse/core';
import { downloadUserAgent, defaultConcurrentDownloads } from './constants.ts';

export class FileSystemDownloader implements IDownloader {
  async downloadChapter(chapter: ManhwaChapter, options: DownloadOptions): Promise<DownloadResult> {
    const {
      path: outputDir,
      concurrency = defaultConcurrentDownloads,
      headers = {},
      onProgress,
    } = options;
    const errors: Error[] = [];
    const downloadedFiles: string[] = [];
    const startTime = Date.now();

    // Ensure directory exists
    // Using Bun Shell for native speed
    await $`mkdir -p "${outputDir}"`;

    const limit = pLimit(concurrency);
    let completed = 0;
    const total = chapter.length;

    // Report initial progress
    onProgress?.({ total, current: 0 });

    const tasks = chapter.map((item, index) =>
      limit(async () => {
        try {
          // Determine extension from URL or fallback to .jpg
          const ext = path.extname(item.img).split('?')[0] || ImageExtensions.JPG;
          // Ensure valid extension
          const urlExt = ext.match(/^\.[a-zA-Z0-9]+$/) ? ext : ImageExtensions.JPG;
          const fileName = `${(index + 1).toString().padStart(4, '0')}${urlExt}`;
          const filePath = path.join(outputDir, fileName);

          // Prepare headers: Global headers + Item-specific headers (Referer)
          const requestHeaders = {
            ...headers,
            ...(item.headerForImage ? { Referer: item.headerForImage } : {}),
            'User-Agent':
              headers['User-Agent'] || defaultBrowserConfig.userAgent || downloadUserAgent,
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
    const response = await fetch(url, {
      method: 'GET',
      headers,
      // Bun fetch typically doesn't support 'timeout' in options directly like axios
      // but we can use signal if needed. For now, rely on default or keep it simple.
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    // Bun.write consumes the response stream automatically
    // Using arrayBuffer() to ensure it reads fully before writing (simple & reliable for images)
    await Bun.write(dest, await response.arrayBuffer());
  }
}
