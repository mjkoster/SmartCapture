/**
 * Simple structured logger with levels.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function log(level: LogLevel, tag: string, message: string, data?: unknown): void {
  if (!shouldLog(level)) return;
  const prefix = `[SmartCapture:${tag}]`;
  const fn = level === 'error' ? console.error
    : level === 'warn' ? console.warn
    : level === 'debug' ? console.debug
    : console.log;

  if (data !== undefined) {
    fn(prefix, message, data);
  } else {
    fn(prefix, message);
  }
}

export function createLogger(tag: string) {
  return {
    debug: (msg: string, data?: unknown) => log('debug', tag, msg, data),
    info: (msg: string, data?: unknown) => log('info', tag, msg, data),
    warn: (msg: string, data?: unknown) => log('warn', tag, msg, data),
    error: (msg: string, data?: unknown) => log('error', tag, msg, data),
  };
}
