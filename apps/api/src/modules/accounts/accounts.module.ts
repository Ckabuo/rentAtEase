import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MessagingModule } from "../messaging/messaging.module";
import { PlansModule } from "../plans/plans.module";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";

@Module({
  imports: [PlansModule, AuthModule, MessagingModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
