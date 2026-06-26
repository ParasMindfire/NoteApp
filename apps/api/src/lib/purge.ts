import cron from 'node-cron';
import { prisma } from './prisma.js';

export async function purgeOldVersions(cutoffOverride?: Date): Promise<void> {
  const cutoff = cutoffOverride ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const { count } = await prisma.noteVersion.deleteMany({
    where: { savedAt: { lt: cutoff } },
  });
  console.log(`[PURGE] Deleted ${count} NoteVersion rows older than 90 days`);
}

export const versionPurgeCron = cron.createTask('0 3 * * *', () => {
  void purgeOldVersions();
});
