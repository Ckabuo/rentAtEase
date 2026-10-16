import { Body, Controller, Headers, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PLAN_CODES, type PlanCode } from "@rae/domain";
import { z } from "zod";
import { Public } from "../../common/auth.guard";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PlansService } from "./plans.service";

const activateSchema = z.object({
  accountId: z.string().min(1),
  planCode: z.enum(PLAN_CODES),
});

@ApiTags("plans")
@Controller("plans")
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Public()
  @Post("activate")
  activate(
    @Body(new ZodValidationPipe(activateSchema)) body: { accountId: string; planCode: PlanCode },
    @Headers("x-plan-admin-secret") secret?: string,
  ) {
    return this.plans.activate(body.accountId, body.planCode, secret);
  }
}
