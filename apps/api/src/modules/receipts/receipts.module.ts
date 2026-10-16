import { Module } from "@nestjs/common";
import { MessagingModule } from "../messaging/messaging.module";
import { PlansModule } from "../plans/plans.module";
import { ReceiptsController } from "./receipts.controller";
import { ReceiptsService } from "./receipts.service";

@Module({
  imports: [MessagingModule, PlansModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
