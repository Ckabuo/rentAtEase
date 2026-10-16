export const QUEUES = {
  reminders: "reminders",
  messages: "messages",
  receipts: "receipts",
  retention: "retention",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const WORKER_CONCURRENCY = 5;
