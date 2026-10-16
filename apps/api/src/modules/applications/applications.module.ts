import { Module } from "@nestjs/common";
import { MessagingModule } from "../messaging/messaging.module";
import { PlansModule } from "../plans/plans.module";
import { TenanciesModule } from "../tenancies/tenancies.module";
import { ApplicationsController } from "./applications.controller";
import { ApplicationsService } from "./applications.service";

@Module({
  imports: [PlansModule, TenanciesModule, MessagingModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
