import { createApp } from './app';
import { env, assertEnv } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { startGenerationWorker } from './jobs/generation.worker';
import { startRetentionJob } from './jobs/retention.job';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  assertEnv();
  await connectDatabase();

  startGenerationWorker();
  startRetentionJob();

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`TryOn engine listening on ${env.publicBaseUrl}`);
    logger.info(`  provider : ${env.ai.provider}`);
    logger.info(`  storage  : ${env.storage.driver} (${env.storage.dir})`);
    logger.info(`  retention: ${env.retention.photoDays || 'never'} days`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Do not let a hung connection hold the process open forever.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error('failed to start', error);
  process.exit(1);
});
