import { Module } from "@nestjs/common";
import { MessagingController } from "./messaging.controller";
import { MessagingService } from "./messaging.service";
import { ReminderService } from "./reminder.service";

@Module({
  controllers: [MessagingController],
  providers: [MessagingService, ReminderService],
  exports: [MessagingService, ReminderService],
})
export class MessagingModule {}
