import { Providers, type ProviderType } from '@manverse/core';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type ScraperOperation = 'search' | 'details' | 'chapters' | 'chapter' | 'image';

export type ScraperLogEvent = {
  id: string;
  timestamp: number;
  requestId?: string;
  provider: ProviderType;
  operation: ScraperOperation;
  ok: boolean;
  durationMs: number;
  errorCode?: string;
  message?: string;
};

export type ScraperLogAction = {
  operation: ScraperOperation;
  total: number;
  success: number;
  failed: number;
  avgDurationMs: number;
  lastError?: {
    message?: string;
    code?: string;
    at?: string;
  };
};

export type ScraperLogProvider = {
  provider: ProviderType;
  total: number;
  success: number;
  failed: number;
  avgDurationMs: number;
  lastError?: {
    message?: string;
    code?: string;
    at?: string;
    operation?: ScraperOperation;
  };
  actions: ScraperLogAction[];
};

export type ScraperLogHealth = {
  updatedAt: string;
  total: number;
  success: number;
  failed: number;
  avgDurationMs: number;
  providers: ScraperLogProvider[];
  recentErrors: ScraperLogEvent[];
};

export type ScraperLoggingStatus = {
  enabled: boolean;
  logFile: string | null;
  sizeBytes: number;
  maxBytes: number;
  maxFiles: number;
};

export type ScraperLogBundle = {
  generatedAt: string;
  status: ScraperLoggingStatus;
  health: ScraperLogHealth;
  recentEvents: ScraperLogEvent[];
  fileTail: string[];
};

type ScraperLogConfig = {
  enabled: boolean;
  maxBytes: number;
  maxFiles: number;
};

const MAX_EVENTS = 200;
const MAX_RECENT_ERRORS = 12;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_FILES = 5;
const DEFAULT_LOG_DIR =
  Bun.env.MANVERSE_LOG_DIR?.trim() ||
  path.resolve(process.cwd(), 'logs');
const LOG_FILE_NAME = 'manverse-scraper.log.jsonl';
const LOG_CONFIG_NAME = 'manverse-scraper-logging.json';

const toIso = (timestamp: number) => new Date(timestamp).toISOString();

const redactMessage = (value?: string) => {
  if (!value) return value;
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer REDACTED')
    .replace(/(access_token|token|authorization|client_secret|client_id)=([^\s&]+)/gi, '$1=REDACTED')
    .replace(/(https?:\/\/[^\s?]+)\?[^\s]+/gi, '$1?[redacted]');
};

const sanitizeEvent = (event: ScraperLogEvent): ScraperLogEvent => ({
  ...event,
  message: redactMessage(event.message),
});

export class ScraperLogger {
  private events: ScraperLogEvent[] = [];
  private config: ScraperLogConfig;
  private logDir: string;
  private logFile: string;
  private configFile: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.logDir = DEFAULT_LOG_DIR;
    this.logFile = path.join(this.logDir, LOG_FILE_NAME);
    this.configFile = path.join(this.logDir, LOG_CONFIG_NAME);
    this.config = this.loadConfig();
  }

  private loadConfig(): ScraperLogConfig {
    const defaults: ScraperLogConfig = {
      enabled: false,
      maxBytes: DEFAULT_MAX_BYTES,
      maxFiles: DEFAULT_MAX_FILES,
    };

    try {
      if (!fs.existsSync(this.configFile)) {
        return defaults;
      }
      const raw = fs.readFileSync(this.configFile, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ScraperLogConfig>;
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaults.enabled,
        maxBytes:
          typeof parsed.maxBytes === 'number' && parsed.maxBytes > 0
            ? parsed.maxBytes
            : defaults.maxBytes,
        maxFiles:
          typeof parsed.maxFiles === 'number' && parsed.maxFiles > 0
            ? parsed.maxFiles
            : defaults.maxFiles,
      };
    } catch {
      return defaults;
    }
  }

  private persistConfig(): void {
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
    } catch {
      // Ignore config write failures.
    }
  }

  private rotateLogs(): void {
    try {
      if (!fs.existsSync(this.logFile)) return;
      const stats = fs.statSync(this.logFile);
      if (stats.size <= this.config.maxBytes) return;

      for (let index = this.config.maxFiles - 1; index >= 1; index -= 1) {
        const from = `${this.logFile}.${index}`;
        const to = `${this.logFile}.${index + 1}`;
        if (!fs.existsSync(from)) continue;
        if (index + 1 > this.config.maxFiles) {
          fs.unlinkSync(from);
        } else {
          fs.renameSync(from, to);
        }
      }

      fs.renameSync(this.logFile, `${this.logFile}.1`);
    } catch {
      // Ignore rotation failures.
    }
  }

  private async appendEvent(event: ScraperLogEvent): Promise<void> {
    if (!this.config.enabled) return;
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
      const line = `${JSON.stringify(sanitizeEvent(event))}\n`;
      await fs.promises.appendFile(this.logFile, line, 'utf-8');
      this.rotateLogs();
    } catch {
      // Ignore file logging failures.
    }
  }

  private enqueueWrite(event: ScraperLogEvent): void {
    this.writeQueue = this.writeQueue
      .then(() => this.appendEvent(event))
      .catch(() => {});
  }

  record(input: Omit<ScraperLogEvent, 'id' | 'timestamp'>): ScraperLogEvent {
    const event: ScraperLogEvent = {
      id: randomUUID(),
      timestamp: Date.now(),
      ...input,
      message: redactMessage(input.message),
    };
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }
    if (this.config.enabled) {
      this.enqueueWrite(event);
    }
    return event;
  }

  list(limit = 50): ScraperLogEvent[] {
    if (limit <= 0) return [];
    return this.events.slice(-limit).reverse();
  }

  clearBuffer(): void {
    this.events = [];
  }

  setLoggingEnabled(enabled: boolean): ScraperLoggingStatus {
    this.config.enabled = enabled;
    this.persistConfig();
    return this.status();
  }

  status(): ScraperLoggingStatus {
    let sizeBytes = 0;
    try {
      if (fs.existsSync(this.logFile)) {
        sizeBytes = fs.statSync(this.logFile).size;
      }
    } catch {
      sizeBytes = 0;
    }
    return {
      enabled: this.config.enabled,
      logFile: this.config.enabled ? this.logFile : null,
      sizeBytes,
      maxBytes: this.config.maxBytes,
      maxFiles: this.config.maxFiles,
    };
  }

  private readFileTail(maxLines = 200): string[] {
    try {
      if (!fs.existsSync(this.logFile)) return [];
      const content = fs.readFileSync(this.logFile, 'utf-8');
      const lines = content.split(/\r?\n/).filter(Boolean);
      return lines.slice(-maxLines);
    } catch {
      return [];
    }
  }

  health(): ScraperLogHealth {
    const totals = { total: 0, success: 0, failed: 0, durationSum: 0 };
    const providerStats = new Map<
      ProviderType,
      ScraperLogProvider & {
        durationSum: number;
        actionMap: Map<ScraperOperation, ScraperLogAction & { durationSum: number }>;
      }
    >();

    for (const event of this.events) {
      totals.total += 1;
      totals.durationSum += event.durationMs;
      if (event.ok) {
        totals.success += 1;
      } else {
        totals.failed += 1;
      }

      const providerKey = event.provider ?? Providers.AsuraScans;
      if (!providerStats.has(providerKey)) {
        providerStats.set(providerKey, {
          provider: providerKey,
          total: 0,
          success: 0,
          failed: 0,
          avgDurationMs: 0,
          actions: [],
          durationSum: 0,
          actionMap: new Map(),
        });
      }

      const provider = providerStats.get(providerKey)!;
      provider.total += 1;
      provider.durationSum += event.durationMs;
      if (event.ok) {
        provider.success += 1;
      } else {
        provider.failed += 1;
        provider.lastError = {
          message: event.message,
          code: event.errorCode,
          at: toIso(event.timestamp),
          operation: event.operation,
        };
      }

      if (!provider.actionMap.has(event.operation)) {
        provider.actionMap.set(event.operation, {
          operation: event.operation,
          total: 0,
          success: 0,
          failed: 0,
          avgDurationMs: 0,
          durationSum: 0,
        });
      }
      const action = provider.actionMap.get(event.operation)!;
      action.total += 1;
      action.durationSum += event.durationMs;
      if (event.ok) {
        action.success += 1;
      } else {
        action.failed += 1;
        action.lastError = {
          message: event.message,
          code: event.errorCode,
          at: toIso(event.timestamp),
        };
      }
    }

    const providers: ScraperLogProvider[] = [];
    for (const provider of providerStats.values()) {
      provider.avgDurationMs = provider.total ? Math.round(provider.durationSum / provider.total) : 0;
      provider.actions = Array.from(provider.actionMap.values()).map((action) => ({
        ...action,
        avgDurationMs: action.total ? Math.round(action.durationSum / action.total) : 0,
      }));
      providers.push(provider);
    }

    const recentErrors = this.events
      .filter((event) => !event.ok)
      .slice(-MAX_RECENT_ERRORS)
      .reverse();

    return {
      updatedAt: new Date().toISOString(),
      total: totals.total,
      success: totals.success,
      failed: totals.failed,
      avgDurationMs: totals.total ? Math.round(totals.durationSum / totals.total) : 0,
      providers,
      recentErrors,
    };
  }

  bundle(): ScraperLogBundle {
    return {
      generatedAt: new Date().toISOString(),
      status: this.status(),
      health: this.health(),
      recentEvents: this.list(100),
      fileTail: this.readFileTail(200),
    };
  }
}

export const scraperLogger = new ScraperLogger();
