import type { Job } from "bullmq";

export async function processReminder(job: Job, run: () => Promise<{ queued: number }>): Promise<void> {
  const result = await run();
  console.info(`reminders job ${job.id ?? "unknown"} queued ${result.queued} messages`);
}
