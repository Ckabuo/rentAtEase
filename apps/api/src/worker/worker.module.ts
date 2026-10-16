import { Module } from "@nestjs/common";
import { ApplicationsModule } from "../modules/applications/applications.module";
import { MessagingModule } from "../modules/messaging/messaging.module";
import { QueueWorkerService } from "./queue-worker.service";

@Module({
  imports: [MessagingModule, ApplicationsModule],
  providers: [QueueWorkerService],
})
export class WorkerModule {}
