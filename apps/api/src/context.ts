import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@gestao-leitos/database/client';

export async function createContext({
  req,
  res,
}: {
  req: FastifyRequest;
  res: FastifyReply;
}) {
  // Extract user from session/JWT
  const userId = req.headers['x-user-id'] as string | undefined;

  return {
    prisma,
    userId,
    req,
    res,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
