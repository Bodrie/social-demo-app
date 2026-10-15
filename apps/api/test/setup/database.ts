import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { TABLES } from '../../src/prisma/tables.js';

export { TABLES };

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(', ')} CASCADE`,
  );
}
