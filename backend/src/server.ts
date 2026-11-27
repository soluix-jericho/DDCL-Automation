import { PrismaClient } from '@prisma/client';
import { buildApp } from './app';
import { backfillCreatedBy, bootstrapAdmin } from './bootstrap';
import { loadConfig } from './config';
import { createRepository } from './repository';
import { startRetentionTimer } from './retention';

async function main(): Promise<void> {
  const config = loadConfig();
  const prisma = new PrismaClient();
  const repo = createRepository(prisma);
  const app = await buildApp({ repo, config });

  // Start order (reliability-design): config -> first admin -> creator backfill -> listen -> retention.
  await bootstrapAdmin(prisma, config, repo.passwords, app.log);
  const { filled } = await backfillCreatedBy(prisma);
  if (filled > 0) app.log.info({ event: 'ddcl_creator_backfilled', filled }, 'DDCL creators backfilled');

  const retention: { stop?: () => void } = {};
  const shutdown = async (): Promise<void> => {
    retention.stop?.();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await app.listen({ port: config.port, host: '0.0.0.0' });
  retention.stop = startRetentionTimer(prisma, app.log).stop;
}

main().catch((err) => {
  // Fail fast: log as JSON to stderr and exit non-zero so Compose shows the container as failed.
  // The message names the missing variable and never carries a password value.
  console.error(JSON.stringify({ level: 'fatal', operation: 'startup', err: String(err) }));
  process.exit(1);
});
