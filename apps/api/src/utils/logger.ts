import pino from 'pino';

/**
 * Centralized logger for the API
 * Based on Pino (same logger used by Fastify)
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
            colorize: true,
          },
        }
      : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
});

/**
 * Create a child logger with additional context
 * 
 * @example
 * ```typescript
 * const orderLogger = createLogger({ module: 'orders' });
 * orderLogger.info({ orderId: '123' }, 'Order created');
 * ```
 */
export function createLogger(context: Record<string, any>) {
  return logger.child(context);
}

/**
 * Log levels available:
 * - trace: Very detailed debugging
 * - debug: Debugging information
 * - info: General information
 * - warn: Warning messages
 * - error: Error messages
 * - fatal: Fatal errors (application crash)
 * 
 * @example
 * ```typescript
 * import { logger } from '../utils/logger';
 * 
 * // Info
 * logger.info({ userId: '123' }, 'User logged in');
 * 
 * // Error
 * logger.error({ error, orderId: '456' }, 'Failed to create order');
 * 
 * // Debug
 * logger.debug({ input }, 'Processing request');
 * 
 * // With child logger
 * const authLogger = createLogger({ module: 'auth' });
 * authLogger.warn({ cpf: '***' }, 'Failed login attempt');
 * ```
 */
