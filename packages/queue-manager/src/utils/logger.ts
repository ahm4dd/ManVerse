/**
 * Simple logger utility
 * Can be extended to use Winston, Pino, or other logging libraries
 */

export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
}

export class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? '';
  }

  private format(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    const prefix = this.prefix ? `[${this.prefix}] ` : '';
    return `${timestamp} ${level} ${prefix}${message}`;
  }

  debug(message: string): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(this.format('DEBUG', message));
    }
  }

  info(message: string): void {
    if (this.level <= LogLevel.INFO) {
      console.info(this.format('INFO', message));
    }
  }

  warn(message: string): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.format('WARN', message));
    }
  }

  error(message: string): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(this.format('ERROR', message));
    }
  }
}

export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}
