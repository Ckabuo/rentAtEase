import { Injectable, Logger } from "@nestjs/common";
import { PLANS, daysBetween, formatNaira, remindersDue, type PlanCode } from "@rae/domain";
import { calendarDate, todayInLagos, toDbDate } from "../../common/dates";
import { phoneDigits } from "../../common/crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { whatsAppTemplates } from "../../config/whatsapp-templates";
import { MessagingService } from "./messaging.service";

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);
  lastRunAt: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  async runSweep(): Promise<{ considered: number; queued: number }> {
    const db = await this.prisma.db();
    const today = todayInLagos();
    const tenancies = await db.tenancy.findMany({
      where: { deletedAt: null, OR: [{ endDate: null }, { endDate: { gte: toDbDate(today) } }] },
      include: {
        tenant: true,
        unit: { include: { property: true } },
        charges: { include: { allocations: { include: { payment: { include: { receipts: true } } } } } },
        account: { include: { subscription: true, memberships: { include: { user: true } } } },
      },
    });
    let queued = 0;
    for (const tenancy of tenancies) {
      const planCode = (tenancy.account.subscription?.planCode ?? "STARTER") as PlanCode;
      if (!PLANS[planCode].whatsappEnabled) continue;
      const open = tenancy.charges
        .map((charge) => ({ charge, outstanding: outstandingOf(charge) }))
        .filter((item) => item.outstanding > 0)
        .sort((left, right) => calendarDate(left.charge.dueDate).localeCompare(calendarDate(right.charge.dueDate)));
      const next = open[0];
      if (!next) continue;
      const dueDate = calendarDate(next.charge.dueDate);
      const due = remindersDue({
        tenancyId: tenancy.id,
        today,
        cycle: tenancy.cycle,
        dueDate,
        outstandingKobo: next.outstanding,
        whatsappConsent: tenancy.tenant.whatsappConsent && !tenancy.tenant.whatsappOptedOutAt,
      });
      const owner = tenancy.account.memberships.find((membership) => membership.role === "OWNER")?.user;
      for (const reminder of due) {
        const to = reminder.audience === "tenant" ? tenancy.tenant.phone : owner?.phone;
        if (!to) continue;
        const unit = `${tenancy.unit.property.name} ${tenancy.unit.label}`;
        const amount = formatNaira(next.outstanding);
        const days = String(Math.max(0, daysBetween(dueDate, today)));
        const body =
          reminder.templateKey === "rae_rent_overdue" || reminder.templateKey === "rae_owner_overdue"
            ? [tenancy.tenant.fullName, unit, amount, days]
            : [tenancy.tenant.fullName, unit, amount, dueDate];
        const result = await this.messaging.sendTemplate({
          accountId: tenancy.accountId,
          to,
          templateKey: whatsAppTemplates.resolveScheduleKey(reminder.templateKey),
          body,
          dedupeKey: `${tenancy.id}:${dueDate}:${reminder.templateKey}:${reminder.daysFromDue}`,
        });
        if (result.status !== "SKIPPED") queued += 1;
      }
    }
    this.lastRunAt = new Date().toISOString();
    this.logger.log(`Reminder sweep considered ${tenancies.length} tenancies and queued ${queued} messages.`);
    return { considered: tenancies.length, queued };
  }

  async remindOne(accountId: string, tenancyId: string) {
    const db = await this.prisma.db();
    const tenancy = await db.tenancy.findFirst({
      where: { id: tenancyId, accountId, deletedAt: null },
      include: { tenant: true, unit: true, charges: true },
    });
    if (!tenancy) return { sent: false, reason: "Tenancy not found." };
    const plan = await db.subscription.findUnique({ where: { accountId } });
    const code = (plan?.planCode ?? "STARTER") as PlanCode;
    if (!PLANS[code].whatsappEnabled) {
      return { sent: false, reason: "WhatsApp reminders are included on Standard and Pro." };
    }
    if (!tenancy.tenant.whatsappConsent || tenancy.tenant.whatsappOptedOutAt) {
      return { sent: false, reason: "This tenant has not agreed to WhatsApp messages." };
    }
    const result = await this.messaging.sendTemplate({
      accountId,
      to: phoneDigits(tenancy.tenant.phone),
      templateKey: whatsAppTemplates.rentReminder(),
      body: [tenancy.tenant.fullName, tenancy.unit.label, formatNaira(tenancy.rentAmountKobo), todayInLagos()],
      dedupeKey: `manual:${tenancy.id}:${todayInLagos()}`,
    });
    return { sent: result.status === "SENT", reason: result.reason };
  }
}

function outstandingOf(charge: {
  amountKobo: number;
  allocations: { amountKobo: number; payment: { receipts: { status: string }[] } }[];
}): number {
  const allocated = charge.allocations.reduce((sum, allocation) => {
    const receipts = allocation.payment.receipts;
    const counts = receipts.length === 0 || receipts.some((receipt) => receipt.status === "ISSUED");
    return counts ? sum + allocation.amountKobo : sum;
  }, 0);
  return Math.max(0, charge.amountKobo - allocated);
}
