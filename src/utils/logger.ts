const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = typeof LOG_LEVELS[number];

function shouldLog(messageLevel: LogLevel): boolean {
  const configuredLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;
  const configuredIndex = LOG_LEVELS.indexOf(configuredLevel);
  const messageIndex = LOG_LEVELS.indexOf(messageLevel);
  return messageIndex >= configuredIndex;
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog('debug')) {
      console.error(JSON.stringify({
        level: 'debug',
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      }));
    }
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog('info')) {
      console.error(JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      }));
    }
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog('warn')) {
      console.error(JSON.stringify({
        level: 'warn',
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      }));
    }
  },
  error: (message: string, error?: unknown) => {
    if (shouldLog('error')) {
      console.error(JSON.stringify({
        level: 'error',
        message,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }));
    }
  },
};
