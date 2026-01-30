import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { TRPCError } from '@trpc/server';
import { appRouter } from './routers';
import { createContext } from './context';
import 'dotenv/config';

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
  maxParamLength: 5000,
});

async function main() {
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
        server.log.error({ path, error }, 'tRPC Error');
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

  server.log.info(`🚀 Server running on http://localhost:${port}`);
  server.log.info(`📡 tRPC endpoint: http://localhost:${port}/trpc`);
  server.log.info(`❤️  Health check: http://localhost:${port}/health`);
}

main().catch((err) => {
  server.log.error(err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});
