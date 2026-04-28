import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // Strip the "file:" prefix if present from DATABASE_URL, and fall back to a known relative path
  const rawUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
  const dbPath = rawUrl.startsWith('file:')
    ? path.resolve(process.cwd(), rawUrl.slice('file:'.length))
    : path.resolve(process.cwd(), rawUrl);

  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  // @ts-expect-error - Prisma v7 adapter constructor
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
