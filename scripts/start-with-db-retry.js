#!/usr/bin/env node
/**
 * Wait for Postgres, run Prisma migrations, then start the app.
 * Retries help when Railway Postgres is waking up / restarting.
 */
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const MAX_ATTEMPTS = Number(process.env.DB_BOOT_MAX_ATTEMPTS || 40);
const DELAY_MS = Number(process.env.DB_BOOT_DELAY_MS || 5000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDatabase() {
  const prisma = new PrismaClient();
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      console.info(`[BOOT] database ready (attempt ${attempt}/${MAX_ATTEMPTS})`);
      await prisma.$disconnect();
      return;
    } catch (error) {
      console.error(
        `[BOOT] database not ready (attempt ${attempt}/${MAX_ATTEMPTS}):`,
        error?.message || error
      );
      try {
        await prisma.$disconnect();
      } catch (_) {
        /* ignore */
      }
      if (attempt >= MAX_ATTEMPTS) {
        throw new Error('Database did not become ready in time');
      }
      await sleep(DELAY_MS);
    }
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[BOOT] DATABASE_URL is missing');
    process.exit(1);
  }

  await waitForDatabase();
  await run('npx', ['prisma', 'migrate', 'deploy']);
  await run('node', ['index.js']);
}

main().catch((error) => {
  console.error('[BOOT] failed', error?.message || error);
  process.exit(1);
});
