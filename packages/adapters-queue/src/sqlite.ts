import { Database } from 'bun:sqlite';
import { v4 as uuidv4 } from 'uuid';
import {
  type IJobQueue,
  type Job,
  type JobResult,
  JobStatus,
  type JobPayload,
  JobType,
} from '@manverse/core';

/**
 * SQLite Job Queue Adapter
 *
 * A professional, persistent local queue that doesn't need Redis.
 * Uses Bun's native high-speed SQLite engine.
 */
export class SQLiteJobQueue implements IJobQueue {
  private db: Database;
  private processor: ((job: Job) => Promise<any>) | null = null;
  private queueName: string;

  constructor(queueName: string, dbPath: string = 'jobs.db') {
    this.queueName = queueName;
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        queue_name TEXT,
        type TEXT,
        status TEXT,
        data TEXT,
        result TEXT,
        error TEXT,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        created_at DATETIME,
        updated_at DATETIME
      )
    `);
  }

  async add(jobData: JobPayload): Promise<string> {
    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO jobs (id, queue_name, type, status, data, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, this.queueName, jobData.type, JobStatus.PENDING, JSON.stringify(jobData.data), now, now],
    );

    if (this.processor) {
      setTimeout(() => this.processNext(), 0);
    }

    return id;
  }

  async getJob(jobId: string): Promise<Job | null> {
    const row = this.db.query('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
    if (!row) return null;
    return this.mapRowToJob(row);
  }

  async waitForAttributes(jobId: string): Promise<JobResult> {
    return new Promise((resolve) => {
      const check = async () => {
        const job = await this.getJob(jobId);
        if (job && (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED)) {
          resolve(this.createJobResult(job));
        } else {
          setTimeout(check, 500);
        }
      };
      check();
    });
  }

  public setWorker(processor: (job: Job) => Promise<any>) {
    this.processor = processor;
    this.processNext();
  }

  private async processNext() {
    if (!this.processor) return;

    const row = this.db
      .query('SELECT * FROM jobs WHERE queue_name = ? AND status = ? LIMIT 1')
      .get(this.queueName, JobStatus.PENDING) as any;

    if (!row) return;

    const job = this.mapRowToJob(row);

    try {
      this.updateStatus(job.id, JobStatus.PROCESSING);
      const result = await this.processor(job);
      this.db.run('UPDATE jobs SET status = ?, result = ?, updated_at = ? WHERE id = ?', [
        JobStatus.COMPLETED,
        JSON.stringify(result),
        new Date().toISOString(),
        job.id,
      ]);
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      this.db.run('UPDATE jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?', [
        JobStatus.FAILED,
        err,
        new Date().toISOString(),
        job.id,
      ]);
    }

    setTimeout(() => this.processNext(), 0);
  }

  private updateStatus(id: string, status: JobStatus) {
    this.db.run('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?', [
      status,
      new Date().toISOString(),
      id,
    ]);
  }

  private mapRowToJob(row: any): Job {
    return {
      id: row.id,
      type: row.type as JobType,
      status: row.status as JobStatus,
      data: JSON.parse(row.data),
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      error: row.error,
    } as any;
  }

  private createJobResult(job: Job): JobResult {
    return {
      jobId: job.id,
      status: job.status as JobStatus,
      data: (job as any).result ? JSON.parse((job as any).result) : job.data,
      error: job.error,
    };
  }
  async close() {
    this.db.close();
  }
}
