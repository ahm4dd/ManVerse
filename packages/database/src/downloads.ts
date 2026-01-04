import { getDatabase } from './db.ts';

export interface DownloadedChapterRecord {
  id: number;
  provider_manga_id: number;
  chapter_number: string;
  file_path: string;
  file_size: number | null;
  downloaded_at: number;
}

export interface DownloadedSeriesSummary {
  provider_manga_id: number;
  provider: string;
  provider_id: string;
  title: string;
  image: string | null;
  chapters_downloaded: number;
  total_size: number;
  last_downloaded: number | null;
}

export interface DownloadedChapterInput {
  providerMangaId: number;
  chapterNumber: string;
  filePath: string;
  fileSize?: number | null;
}

export function upsertDownloadedChapter(input: DownloadedChapterInput): DownloadedChapterRecord {
  const db = getDatabase();
  const params = {
    $provider_manga_id: input.providerMangaId,
    $chapter_number: input.chapterNumber,
    $file_path: input.filePath,
    $file_size: input.fileSize ?? null,
  };

  db.prepare(
    `
      INSERT OR REPLACE INTO downloaded_chapters (
        provider_manga_id,
        chapter_number,
        file_path,
        file_size,
        downloaded_at
      ) VALUES (
        $provider_manga_id,
        $chapter_number,
        $file_path,
        $file_size,
        unixepoch()
      )
    `,
  ).run(params);

  return getDownloadedChapter(input.providerMangaId, input.chapterNumber) as DownloadedChapterRecord;
}

export function getDownloadedChapter(
  providerMangaId: number,
  chapterNumber: string,
): DownloadedChapterRecord | null {
  const db = getDatabase();
  const row = db
    .prepare(
      'SELECT * FROM downloaded_chapters WHERE provider_manga_id = ? AND chapter_number = ?',
    )
    .get(providerMangaId, chapterNumber) as DownloadedChapterRecord | undefined;
  return row ?? null;
}

export function getDownloadedChapterById(id: number): DownloadedChapterRecord | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM downloaded_chapters WHERE id = ?')
    .get(id) as DownloadedChapterRecord | undefined;
  return row ?? null;
}

export function listDownloadedChapters(
  providerMangaId?: number,
): DownloadedChapterRecord[] {
  const db = getDatabase();
  if (providerMangaId) {
    return db
      .prepare('SELECT * FROM downloaded_chapters WHERE provider_manga_id = ? ORDER BY downloaded_at DESC')
      .all(providerMangaId) as DownloadedChapterRecord[];
  }
  return db
    .prepare('SELECT * FROM downloaded_chapters ORDER BY downloaded_at DESC')
    .all() as DownloadedChapterRecord[];
}

export function getDownloadedSizeForSeries(providerMangaId: number): number {
  const db = getDatabase();
  const row = db
    .prepare('SELECT COALESCE(SUM(file_size), 0) as total_size FROM downloaded_chapters WHERE provider_manga_id = ?')
    .get(providerMangaId) as { total_size?: number } | undefined;
  return row?.total_size ?? 0;
}

export function listDownloadedSeries(): DownloadedSeriesSummary[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `
        SELECT
          pm.id as provider_manga_id,
          pm.provider as provider,
          pm.provider_id as provider_id,
          pm.title as title,
          pm.image as image,
          COUNT(dc.id) as chapters_downloaded,
          COALESCE(SUM(dc.file_size), 0) as total_size,
          MAX(dc.downloaded_at) as last_downloaded
        FROM downloaded_chapters dc
        JOIN provider_manga pm ON pm.id = dc.provider_manga_id
        GROUP BY pm.id
        ORDER BY last_downloaded DESC
      `,
    )
    .all() as DownloadedSeriesSummary[];

  return rows.map((row) => ({
    provider_manga_id: row.provider_manga_id,
    provider: row.provider,
    provider_id: row.provider_id,
    title: row.title,
    image: row.image ?? null,
    chapters_downloaded: row.chapters_downloaded,
    total_size: row.total_size,
    last_downloaded: row.last_downloaded ?? null,
  }));
}
