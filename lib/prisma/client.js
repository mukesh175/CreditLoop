import { PrismaClient } from '@prisma/client';

/**
 * Serverless-safe Prisma singleton. Vercel functions are short-lived and may be
 * recycled, so we cache the client on globalThis to avoid exhausting Neon's
 * connection pool across warm invocations.
 */
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__creditloopPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__creditloopPrisma = prisma;
}

export default prisma;
