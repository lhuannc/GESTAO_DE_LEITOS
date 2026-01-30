import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@gestao-leitos/database/client';
import { verifyToken } from './utils/jwt';

export async function createContext({
  req,
  res,
}: {
  req: FastifyRequest;
  res: FastifyReply;
}) {
  let userId: string | undefined;

  // Extract JWT from cookie
  const token = req.cookies.token;

  if (token) {
    try {
      const payload = verifyToken(token);
      userId = payload.userId;
    } catch (error) {
      // Invalid or expired token - log but don't throw
      // This allows public endpoints to work
      console.warn('JWT verification failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  return {
    prisma,
    userId,
    req,
    res,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
