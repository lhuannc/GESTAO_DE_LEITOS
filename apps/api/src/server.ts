import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { TRPCError } from '@trpc/server';
import { appRouter } from './routers';
import { createContext } from './context';
import { loggingMiddleware } from './middleware/logging';
import { logger } from './utils/logger';
import 'dotenv/config';

const server = Fastify({
  logger: false, // Disable Fastify's logger, use our custom logger
  maxParamLength: 5000,
});

async function main() {
  // Logging middleware (must be first)
  server.addHook('onRequest', loggingMiddleware);

  // Cookie parser (must be registered before routes)
  await server.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || 'dev-cookie-secret-change-in-production',
  });

  // CORS with credentials support
  await server.register(cors, {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3000'
    ],
    credentials: true, // Allow cookies to be sent
  });

  // tRPC
  await server.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ path, error }: { path?: string; error: TRPCError }) {
        logger.error({ path, error: error.message, code: error.code }, 'tRPC Error');
      },
    },
  });

  // Health check
  server.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // Start server
  const port = parseInt(process.env.PORT || '4000', 10);
  const host = process.env.HOST || '0.0.0.0';

  await server.listen({ port, host });

  logger.info(`🚀 Server running on http://localhost:${port}`);
  logger.info(`📡 tRPC endpoint: http://localhost:${port}/trpc`);
  logger.info(`❤️  Health check: http://localhost:${port}/health`);
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await server.close();
  logger.info('Server closed');
  process.exit(0);
});
