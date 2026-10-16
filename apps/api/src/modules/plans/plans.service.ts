import { ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { PLANS, type PlanCode } from "@rae/domain";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async limits(accountId: string) {
    const db = await this.prisma.db();
    const subscription = await db.subscription.findUnique({ where: { accountId } });
    const code = (subscription?.planCode ?? "STARTER") as PlanCode;
    return PLANS[code];
  }

  async activate(accountId: string, planCode: PlanCode, secret: string | undefined, actorUserId?: string) {
    const expected = process.env.PLAN_ADMIN_SECRET?.trim();
    if (!expected) {
      throw new ServiceUnavailableException(
        "PLAN_ADMIN_SECRET is not set. Add it to activate Standard or Pro. Starter works without it.",
      );
    }
    if (!secret || secret !== expected) throw new UnauthorizedException("Plan activation secret did not match.");
    const db = await this.prisma.db();
    const account = await db.account.findUnique({ where: { id: accountId } });
    if (!account) throw new ForbiddenException("That account does not exist.");
    await db.subscription.upsert({
      where: { accountId },
      update: { planCode, activatedByUserId: actorUserId, activatedAt: new Date(), status: "ACTIVE" },
      create: { accountId, planCode, activatedByUserId: actorUserId },
    });
    return { accountId, planCode };
  }
}
