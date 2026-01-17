export type RendererLogLevel = 'info' | 'warn' | 'error';

export type RendererLogEvent = {
  id: string;
  ts: string;
  level: RendererLogLevel;
  message: string;
  data?: Record<string, unknown> | null;
};

export type RendererLogStatus = {
  eventCount: number;
  lastEventAt: string | null;
};

export type RendererLogBundle = {
  generatedAt: string;
  url: string;
  userAgent: string;
  locale: string;
  events: RendererLogEvent[];
};

const MAX_EVENTS = 200;
const events: RendererLogEvent[] = [];
let initialized = false;

const redactMessage = (value?: string) => {
  if (!value) return value;
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer REDACTED')
    .replace(/(access_token|token|authorization|client_secret|client_id)=([^\s&]+)/gi, '$1=REDACTED')
    .replace(/(https?:\/\/[^\s?]+)\?[^\s]+/gi, '$1?[redacted]');
};

const toErrorData = (error: unknown) => {
  if (!error) return null;
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
};

const pushEvent = (
  level: RendererLogLevel,
  message: string,
  data?: Record<string, unknown> | null,
): RendererLogEvent => {
  const event: RendererLogEvent = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    ts: new Date().toISOString(),
    level,
    message: redactMessage(message) ?? message,
    data: data ?? null,
  };
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
  return event;
};

export const rendererLogger = {
  init: () => {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;
    window.addEventListener('error', (event) => {
      pushEvent('error', 'window.error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: toErrorData(event.error),
      });
    });
    window.addEventListener('unhandledrejection', (event) => {
      pushEvent('error', 'window.unhandledrejection', {
        reason: toErrorData(event.reason),
      });
    });
    pushEvent('info', 'renderer.init', {
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  },
  log: (message: string, data?: Record<string, unknown> | null) =>
    pushEvent('info', message, data),
  warn: (message: string, data?: Record<string, unknown> | null) =>
    pushEvent('warn', message, data),
  error: (message: string, data?: Record<string, unknown> | null) =>
    pushEvent('error', message, data),
  list: (limit = 50): RendererLogEvent[] => {
    if (limit <= 0) return [];
    return events.slice(-limit).reverse();
  },
  clear: () => {
    events.length = 0;
  },
  status: (): RendererLogStatus => {
    const last = events[events.length - 1];
    return {
      eventCount: events.length,
      lastEventAt: last?.ts ?? null,
    };
  },
  exportBundle: (): RendererLogBundle => ({
    generatedAt: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    locale: typeof navigator !== 'undefined' ? navigator.language : '',
    events: [...events],
  }),
};
