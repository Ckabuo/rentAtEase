import type { Job } from "bullmq";

export async function processRetention(job: Job, run: () => Promise<number>): Promise<void> {
  const purged = await run();
  console.info(`retention job ${job.id ?? "unknown"} purged documents for ${purged} applications`);
}
