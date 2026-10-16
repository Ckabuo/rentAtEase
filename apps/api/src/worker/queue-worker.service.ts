import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { Queue, Worker, type Job } from "bullmq";
import { ApplicationsService } from "../modules/applications/applications.service";
import { ReminderService } from "../modules/messaging/reminder.service";
import { processMessage } from "./processors/messages";
import { processReceipt } from "./processors/receipts";
import { processReminder } from "./processors/reminders";
import { processRetention } from "./processors/retention";
import { QUEUES, WORKER_CONCURRENCY, type QueueName } from "./queues";

@Injectable()
export class QueueWorkerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(QueueWorkerService.name);
  private workers: Worker[] = [];
  private queues: Queue[] = [];

  constructor(
    private readonly reminders: ReminderService,
    private readonly applications: ApplicationsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn("REDIS_URL is not set; reminder workers are not running");
      return;
    }

    const connection = { url: redisUrl };
    const processors: Record<QueueName, (job: Job) => Promise<void>> = {
      reminders: (job) => processReminder(job, () => this.reminders.runSweep()),
      messages: processMessage,
      receipts: processReceipt,
      retention: (job) => processRetention(job, () => this.applications.purgeExpired()),
    };

    this.workers = Object.values(QUEUES).map(
      (name) =>
        new Worker(name, processors[name], {
          connection,
          concurrency: WORKER_CONCURRENCY,
        }),
    );

    const reminderQueue = new Queue(QUEUES.reminders, { connection });
    const retentionQueue = new Queue(QUEUES.retention, { connection });
    await reminderQueue.upsertJobScheduler(
      "daily-reminders",
      { pattern: "0 8 * * *", tz: "Africa/Lagos" },
      { name: "daily" },
    );
    await retentionQueue.upsertJobScheduler(
      "daily-retention",
      { pattern: "30 8 * * *", tz: "Africa/Lagos" },
      { name: "daily" },
    );
    this.queues = [reminderQueue, retentionQueue];

    for (const worker of this.workers) {
      worker.on("failed", (job, error) => {
        this.logger.error(`${worker.name} job ${job?.id ?? "unknown"} failed: ${error.message}`);
      });
    }

    this.logger.log("Reminder workers are listening. Daily sweep is 08:00 Africa/Lagos.");
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
    await Promise.all(this.queues.map((queue) => queue.close()));
  }
}
