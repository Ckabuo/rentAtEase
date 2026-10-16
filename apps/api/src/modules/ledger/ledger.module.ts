import { Module } from "@nestjs/common";
import { MessagingModule } from "../messaging/messaging.module";
import { PlansModule } from "../plans/plans.module";
import { ReceiptsModule } from "../receipts/receipts.module";
import { LedgerController } from "./ledger.controller";
import { LedgerService } from "./ledger.service";

@Module({
  imports: [ReceiptsModule, MessagingModule, PlansModule],
  controllers: [LedgerController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
