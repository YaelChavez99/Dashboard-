import { PrismaClient } from "@prisma/client";

// Standard Next.js singleton pattern — avoids exhausting Cloud SQL
// connections from hot-reloaded module instances in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
