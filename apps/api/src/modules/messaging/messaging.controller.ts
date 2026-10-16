import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentAccount, type AccountContext } from "../../common/account-context";
import { assertOwner } from "../../common/roles";
import { REMINDER_SCHEDULE } from "@rae/domain";
import { MessagingService } from "./messaging.service";
import { ReminderService } from "./reminder.service";

@ApiTags("messaging")
@ApiBearerAuth()
@Controller("messaging")
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly reminders: ReminderService,
  ) {}

  @Get()
  async overview(@CurrentAccount() account: AccountContext) {
    const messages = await this.messaging.list(account.accountId);
    return {
      schedule: REMINDER_SCHEDULE,
      lastSweepAt: this.reminders.lastRunAt,
      messages: messages.map((message) => ({
        id: message.id,
        to: `•••${message.toAddress.slice(-4)}`,
        status: message.status,
        failureReason: message.failureReason,
        createdAt: message.createdAt.toISOString(),
        templateKey: (message.payload as { templateKey?: string }).templateKey ?? null,
      })),
    };
  }

  @Post("reminders/run")
  run(@CurrentAccount() account: AccountContext) {
    assertOwner(account);
    return this.reminders.runSweep();
  }

  @Post("tenancies/:id/remind")
  remind(@CurrentAccount() account: AccountContext, @Param("id") id: string) {
    return this.reminders.remindOne(account.accountId, id);
  }
}
