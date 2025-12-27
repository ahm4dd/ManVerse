export const QueueNames = {
  SCRAPER_JOBS: 'scraper.jobs',
  PDF_JOBS: 'pdf.jobs',
  UPLOAD_JOBS: 'upload.jobs',
} as const;

export type QueueNames = (typeof QueueNames)[keyof typeof QueueNames];
