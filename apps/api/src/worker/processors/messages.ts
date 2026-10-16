import type { Job } from "bullmq";

export async function processMessage(job: Job): Promise<void> {
  console.info(`messages job ${job.id ?? "unknown"} is handled inline when a template is sent`);
}
