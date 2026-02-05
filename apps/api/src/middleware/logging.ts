import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

/**
 * Logging middleware for HTTP requests
 * Adds request-id for correlation and logs all requests with timing
 */
export async function loggingMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Generate unique request ID for correlation
  const requestId = randomUUID();
  
  // Add request ID to request object for use in other parts of the app
  (request as any).requestId = requestId;

  // Add request ID to response headers
  reply.header('X-Request-ID', requestId);

  // Start timer
  const startTime = Date.now();

  // Log incoming request
  logger.info(
    {
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      userId: request.headers['x-user-id'] || undefined,
    },
    'Incoming request'
  );

  // Hook to log response
  reply.raw.on('finish', () => {
    const duration = Date.now() - startTime;
    
    const logData = {
      requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration,
      userId: request.headers['x-user-id'] || undefined,
    };

    // Log based on status code
    if (reply.statusCode >= 500) {
      logger.error(logData, 'Request failed with server error');
    } else if (reply.statusCode >= 400) {
      logger.warn(logData, 'Request failed with client error');
    } else {
      logger.info(logData, 'Request completed');
    }
  });
}

/**
 * Usage in server.ts:
 * 
 * @example
 * ```typescript
 * import { loggingMiddleware } from './middleware/logging';
 * 
 * // Register before routes
 * server.addHook('onRequest', loggingMiddleware);
 * ```
 */
