import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { applicationDecisionSchema } from "@rae/schemas";
import { Public } from "../../common/auth.guard";
import { CurrentAccount, type AccountContext } from "../../common/account-context";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { ApplicationsService } from "./applications.service";

@ApiTags("applications")
@ApiBearerAuth()
@Controller("applications")
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  list(@CurrentAccount() account: AccountContext) {
    return this.applications.list(account.accountId);
  }

  @Get(":id")
  get(@CurrentAccount() account: AccountContext, @Param("id") id: string) {
    return this.applications.get(account, id);
  }

  @Post(":id/decision")
  decide(
    @CurrentAccount() account: AccountContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(applicationDecisionSchema)) body: ReturnType<typeof applicationDecisionSchema.parse>,
  ) {
    return this.applications.decide(account, id, body);
  }

  @Post(":id/reveal")
  reveal(@CurrentAccount() account: AccountContext, @Param("id") id: string) {
    return this.applications.revealId(account, id);
  }

  @Public()
  @Post(":id/resend-notification")
  resendNotification(@Param("id") id: string) {
    return this.applications.resendReceivedNotificationPublic(id);
  }
}
