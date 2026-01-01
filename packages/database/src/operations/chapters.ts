import { getDatabase } from '../db.js';
import {
  type DownloadedChapterDb,
  type DownloadedChapterInput,
  DownloadedChapterInputSchema,
} from '../types.js';
import { unlinkSync } from 'node:fs';

/**
 * Record a downloaded chapter in the database
 * Returns the chapter ID
 */
export function recordDownload(chapter: DownloadedChapterInput): number {
  const db = getDatabase();
  const validated = DownloadedChapterInputSchema.parse(chapter);

  const query = db.prepare(`
    INSERT INTO downloaded_chapters (
      provider_manga_id, chapter_number, chapter_title, chapter_url,
      file_path, file_size, page_count, downloaded_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    ON CONFLICT(provider_manga_id, chapter_number) DO UPDATE SET
      chapter_title = excluded.chapter_title,
      chapter_url = excluded.chapter_url,
      file_path = excluded.file_path,
      file_size = excluded.file_size,
      page_count = excluded.page_count,
      downloaded_at = excluded.downloaded_at
  `);

  const result = query.run(
    validated.provider_manga_id,
    validated.chapter_number,
    validated.chapter_title ?? null,
    validated.chapter_url ?? null,
    validated.file_path,
    validated.file_size ?? null,
    validated.page_count ?? null,
    validated.downloaded_at,
  );

  return Number(result.lastInsertRowid);
}

/**
 * Get all downloaded chapters for a manga
 */
export function getDownloadedChapters(providerMangaId: number): DownloadedChapterDb[] {
  const db = getDatabase();

  const query = db.prepare<DownloadedChapterDb, [number]>(`
    SELECT * FROM downloaded_chapters 
    WHERE provider_manga_id = ?1 
    ORDER BY CAST(chapter_number AS REAL) ASC
  `);

  return query.all(providerMangaId);
}

/**
 * Check if specific chapter is downloaded
 */
export function isChapterDownloaded(providerMangaId: number, chapterNumber: string): boolean {
  const db = getDatabase();

  const query = db.prepare<{ count: number }, [number, string]>(`
    SELECT COUNT(*) as count FROM downloaded_chapters
    WHERE provider_manga_id = ?1 AND chapter_number = ?2
  `);

  const result = query.get(providerMangaId, chapterNumber);
  return (result?.count || 0) > 0;
}

/**
 * Get chapter file path
 */
export function getChapterPath(providerMangaId: number, chapterNumber: string): string | null {
  const db = getDatabase();

  const query = db.prepare<{ file_path: string }, [number, string]>(`
    SELECT file_path FROM downloaded_chapters
    WHERE provider_manga_id = ?1 AND chapter_number = ?2
  `);

  const result = query.get(providerMangaId, chapterNumber);
  return result?.file_path || null;
}

/**
 * Get chapter by ID
 */
export function getChapterById(id: number): DownloadedChapterDb | null {
  const db = getDatabase();

  const query = db.prepare<DownloadedChapterDb, [number]>(`
    SELECT * FROM downloaded_chapters WHERE id = ?1
  `);

  return query.get(id) || null;
}

/**
 * Delete chapter record (and optionally the file)
 */
export function deleteChapter(id: number, deleteFile = false): void {
  const db = getDatabase();

  if (deleteFile) {
    // Get file path before deleting record
    const chapter = getChapterById(id);
    if (chapter) {
      try {
        unlinkSync(chapter.file_path);
      } catch (error) {
        // File might not exist or be inaccessible, continue with DB deletion
        console.warn(`Could not delete file at ${chapter.file_path}:`, error);
      }
    }
  }

  const query = db.prepare(`DELETE FROM downloaded_chapters WHERE id = ?1`);
  query.run(id);
}

/**
 * Get download statistics
 */
export function getDownloadStats(): {
  totalChapters: number;
  totalSize: number;
  totalPages: number;
} {
  const db = getDatabase();

  const query = db.prepare<{ totalChapters: number; totalSize: number; totalPages: number }, []>(`
    SELECT 
      COUNT(*) as totalChapters,
      COALESCE(SUM(file_size), 0) as totalSize,
      COALESCE(SUM(page_count), 0) as totalPages
    FROM downloaded_chapters
  `);

  const result = query.get();
  return {
    totalChapters: result?.totalChapters || 0,
    totalSize: result?.totalSize || 0,
    totalPages: result?.totalPages || 0,
  };
}

/**
 * Get download statistics for specific manga
 */
export function getMangaDownloadStats(providerMangaId: number): {
  chapterCount: number;
  totalSize: number;
  totalPages: number;
} {
  const db = getDatabase();

  const query = db.prepare<
    { chapterCount: number; totalSize: number; totalPages: number },
    [number]
  >(`
    SELECT 
      COUNT(*) as chapterCount,
      COALESCE(SUM(file_size), 0) as totalSize,
      COALESCE(SUM(page_count), 0) as totalPages
    FROM downloaded_chapters
    WHERE provider_manga_id = ?1
  `);

  const result = query.get(providerMangaId);
  return {
    chapterCount: result?.chapterCount || 0,
    totalSize: result?.totalSize || 0,
    totalPages: result?.totalPages || 0,
  };
}

/**
 * Delete all chapters for a manga
 */
export function deleteAllChapters(providerMangaId: number, deleteFiles = false): number {
  const db = getDatabase();

  if (deleteFiles) {
    const chapters = getDownloadedChapters(providerMangaId);
    for (const chapter of chapters) {
      try {
        unlinkSync(chapter.file_path);
      } catch (error) {
        console.warn(`Could not delete file at ${chapter.file_path}:`, error);
      }
    }
  }

  const query = db.prepare(`DELETE FROM downloaded_chapters WHERE provider_manga_id = ?1`);
  const result = query.run(providerMangaId);
  return result.changes;
}
