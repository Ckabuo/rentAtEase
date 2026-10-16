import type { Job } from "bullmq";

export async function processReceipt(job: Job): Promise<void> {
  console.info(`receipts job ${job.id ?? "unknown"} is rendered when the payment is recorded`);
}
