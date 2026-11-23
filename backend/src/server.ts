import { PrismaClient } from '@prisma/client';
import { buildApp } from './app';
import { loadConfig } from './config';
import { createRepository } from './repository';

async function main(): Promise<void> {
  const config = loadConfig();
  const prisma = new PrismaClient();
  const app = await buildApp({ repo: createRepository(prisma), config });

  const shutdown = async (): Promise<void> => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  // Fail fast: log as JSON to stderr and exit non-zero so Compose shows the container as failed.
  console.error(JSON.stringify({ level: 'fatal', operation: 'startup', err: String(err) }));
  process.exit(1);
});
