import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  MAX_ADVANCE_MONTHS,
  addCalendarDays,
  addCalendarMonths,
  formatNaira,
  generateCharges,
  isDuplicatePayment,
  previewAllocation,
  type OpenCharge,
  type PaymentCategory,
  type PaymentMethod,
} from "@rae/domain";
import type { RecordPayment, VoidReceipt } from "@rae/schemas";
import type { AccountContext } from "../../common/account-context";
import { calendarDate, toDbDate, todayInLagos } from "../../common/dates";
import { assertOwner } from "../../common/roles";
import { whatsAppTemplates } from "../../config/whatsapp-templates";
import { AuditService } from "../audit/audit.service";
import { MessagingService } from "../messaging/messaging.service";
import { PlansService } from "../plans/plans.service";
import { ReceiptsService } from "../receipts/receipts.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../../prisma/types";

type ChargeRow = {
  id: string;
  kind: "CYCLE" | "ONE_OFF";
  category: PaymentCategory;
  periodStart: Date | null;
  periodEnd: Date | null;
  dueDate: Date;
  amountKobo: number;
  allocations: { amountKobo: number; payment: { receipts: { status: "ISSUED" | "VOID" }[] } }[];
};

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receipts: ReceiptsService,
    private readonly messaging: MessagingService,
    private readonly plans: PlansService,
    private readonly audit: AuditService,
  ) {}

  async preview(account: AccountContext, input: RecordPayment) {
    const db = await this.prisma.db();
    const tenancy = await this.loadTenancy(db, account.accountId, input.tenancyId);
    const allocation = this.planAllocation(tenancy, input);
    return {
      summary: allocation.summary,
      unallocatedKobo: allocation.unallocatedKobo,
      lines: allocation.lines.map((line) => ({
        dueDate: line.dueDate,
        amountKobo: line.amountKobo,
        label: line.label,
      })),
      duplicateWarning: this.duplicateWarning(tenancy, input),
    };
  }

  async record(account: AccountContext, input: RecordPayment) {
    const db = await this.prisma.db();
    const existing = await db.payment.findUnique({
      where: { accountId_idempotencyKey: { accountId: account.accountId, idempotencyKey: input.idempotencyKey } },
      include: { receipts: true },
    });
    if (existing) {
      const receipt = existing.receipts.find((item) => item.status === "ISSUED");
      return {
        paymentId: existing.id,
        receiptId: receipt?.id ?? null,
        receiptNumber: receipt?.number ?? null,
        summary: "This payment was already recorded.",
        alreadyRecorded: true,
      };
    }

    const tenancy = await this.loadTenancy(db, account.accountId, input.tenancyId);
    if (this.duplicateWarning(tenancy, input) && !input.acknowledgeDuplicate) {
      throw new ConflictException({
        message: "A matching payment was recorded in the last 24 hours. Confirm to record it again.",
        duplicate: true,
      });
    }
    const allocation = this.planAllocation(tenancy, input);
    if (allocation.unallocatedKobo > 0) {
      throw new BadRequestException(allocation.summary);
    }

    const result = await db.$transaction(async (tx) => {
      const client = tx as Db;
      const chargeIds = await this.persistDrafts(client, account.accountId, tenancy, allocation.lines);
      const payment = await client.payment.create({
        data: {
          accountId: account.accountId,
          tenancyId: tenancy.id,
          amountKobo: input.amountKobo,
          paidOn: toDbDate(input.paidOn),
          method: input.method,
          category: input.category,
          recordedByUserId: account.userId,
          idempotencyKey: input.idempotencyKey,
          note: input.note,
        },
      });
      for (const line of allocation.lines) {
        const chargeId = line.chargeId.startsWith("draft:") ? chargeIds.get(line.chargeId) : line.chargeId;
        if (!chargeId) {
          throw new BadRequestException(
            "This payment could not be applied to the ledger. Preview again, or match the outstanding amount on Tenants.",
          );
        }
        await client.allocation.create({
          data: { accountId: account.accountId, paymentId: payment.id, chargeId, amountKobo: line.amountKobo },
        });
      }
      await this.recomputeTenancy(client, account.accountId, tenancy.id);
      const fresh = await this.loadTenancy(client, account.accountId, tenancy.id);
      const receipt = await this.receipts.issue(client, {
        accountId: account.accountId,
        accountCode: account.accountId.slice(-4),
        paymentId: payment.id,
        issuedOn: input.paidOn,
        tenantName: fresh.tenant.fullName,
        propertyName: fresh.unit.property.name,
        unitLabel: fresh.unit.label,
        amountKobo: input.amountKobo,
        method: input.method,
        category: input.category,
        summary: allocation.summary,
      });
      await this.audit.write(client, {
        accountId: account.accountId,
        actorUserId: account.userId,
        action: "PAYMENT_RECORDED",
        entityType: "Payment",
        entityId: payment.id,
        after: { amountKobo: input.amountKobo, receiptNumber: receipt.number, summary: allocation.summary },
      });
      return { paymentId: payment.id, receipt, summary: allocation.summary, tenant: fresh.tenant, unit: fresh.unit };
    });

    let whatsapp: { sent: boolean; reason?: string };
    try {
      whatsapp = await this.notifyPayment(
        account,
        result.tenant,
        result.unit.property.name,
        result.unit.label,
        input,
        result.receipt,
      );
    } catch {
      whatsapp = { sent: false, reason: "Payment was recorded. Download the receipt from Receipts and share it yourself." };
    }
    return {
      paymentId: result.paymentId,
      receiptId: result.receipt.id,
      receiptNumber: result.receipt.number,
      publicPath: result.receipt.publicPath,
      summary: result.summary,
      alreadyRecorded: false,
      whatsapp,
    };
  }

  async voidReceipt(account: AccountContext, receiptId: string, input: VoidReceipt) {
    assertOwner(account);
    const db = await this.prisma.db();
    const receipt = await db.receipt.findFirst({
      where: { id: receiptId, accountId: account.accountId, status: "ISSUED" },
      include: { payment: true },
    });
    if (!receipt) throw new NotFoundException("Receipt not found.");
    await db.$transaction(async (tx) => {
      const client = tx as Db;
      await client.receipt.update({
        where: { id: receipt.id },
        data: { status: "VOID", voidedAt: new Date(), voidReason: input.reason },
      });
      await this.recomputeTenancy(client, account.accountId, receipt.payment.tenancyId);
      await this.audit.write(client, {
        accountId: account.accountId,
        actorUserId: account.userId,
        action: "RECEIPT_VOIDED",
        entityType: "Receipt",
        entityId: receipt.id,
        after: { reason: input.reason, number: receipt.number },
      });
    });
    if (!input.replacement) return { voided: true, receiptNumber: receipt.number };
    const replacement = await this.record(account, { ...input.replacement, tenancyId: receipt.payment.tenancyId });
    if (replacement.receiptId) {
      await db.receipt.update({ where: { id: replacement.receiptId }, data: { replacesReceiptId: receipt.id } });
    }
    return { voided: true, replacement };
  }

  async openTenancy(
    db: Db,
    input: {
      accountId: string;
      userId: string;
      tenancyId: string;
      paidThrough?: string;
      openingArrearsKobo: number;
    },
  ): Promise<void> {
    const tenancy = await this.loadTenancy(db, input.accountId, input.tenancyId);
    const today = todayInLagos();
    const through = input.paidThrough && input.paidThrough > today ? input.paidThrough : today;
    const drafts = generateCharges({
      startDate: calendarDate(tenancy.startDate),
      cycle: tenancy.cycle,
      rentAmountKobo: tenancy.rentAmountKobo,
      throughDate: through,
      rates: ratesOf(tenancy),
    });
    for (const draft of drafts) {
      await db.charge.create({
        data: {
          accountId: input.accountId,
          tenancyId: tenancy.id,
          kind: "CYCLE",
          category: "RENT",
          periodStart: draft.periodStart ? toDbDate(draft.periodStart) : null,
          periodEnd: draft.periodEnd ? toDbDate(draft.periodEnd) : null,
          dueDate: toDbDate(draft.dueDate),
          amountKobo: draft.amountKobo,
        },
      });
    }
    if (input.openingArrearsKobo > 0) {
      await db.charge.create({
        data: {
          accountId: input.accountId,
          tenancyId: tenancy.id,
          kind: "ONE_OFF",
          category: "RENT",
          dueDate: toDbDate(addCalendarDays(calendarDate(tenancy.startDate), -1)),
          amountKobo: input.openingArrearsKobo,
        },
      });
    }
    if (!input.paidThrough) return;
    const refreshed = await this.loadTenancy(db, input.accountId, tenancy.id);
    const lines: { chargeId: string; amountKobo: number }[] = [];
    for (const charge of refreshed.charges) {
      if (charge.kind !== "CYCLE" || !charge.periodStart || !charge.periodEnd) continue;
      const start = calendarDate(charge.periodStart);
      const end = calendarDate(charge.periodEnd);
      if (end <= input.paidThrough) lines.push({ chargeId: charge.id, amountKobo: charge.amountKobo });
      else if (start <= input.paidThrough) {
        const span = daysInclusive(start, end);
        const covered = daysInclusive(start, input.paidThrough);
        const amount = Math.round((charge.amountKobo * covered) / span);
        if (amount > 0) lines.push({ chargeId: charge.id, amountKobo: amount });
      }
    }
    const total = lines.reduce((sum, line) => sum + line.amountKobo, 0);
    if (total <= 0) return;
    const payment = await db.payment.create({
      data: {
        accountId: input.accountId,
        tenancyId: tenancy.id,
        amountKobo: total,
        paidOn: toDbDate(input.paidThrough),
        method: "OTHER",
        category: "RENT",
        recordedByUserId: input.userId,
        idempotencyKey: crypto.randomUUID(),
        note: "Already paid when the tenancy was added",
      },
    });
    for (const line of lines) {
      await db.allocation.create({
        data: { accountId: input.accountId, paymentId: payment.id, chargeId: line.chargeId, amountKobo: line.amountKobo },
      });
    }
    await this.recomputeTenancy(db, input.accountId, tenancy.id);
  }

  private async notifyPayment(
    account: AccountContext,
    tenant: { fullName: string; phone: string; whatsappConsent: boolean; whatsappOptedOutAt: Date | null },
    propertyName: string,
    unitLabel: string,
    input: RecordPayment,
    receipt: { id: string; number: string },
  ) {
    const plan = await this.plans.limits(account.accountId);
    if (!plan.whatsappEnabled) {
      return { sent: false, reason: "WhatsApp receipts are included on Standard and Pro. Download the PDF and share it yourself." };
    }
    if (!tenant.whatsappConsent || tenant.whatsappOptedOutAt) {
      return { sent: false, reason: "This tenant has not agreed to WhatsApp, or they opted out." };
    }
    const result = await this.messaging.sendTemplate({
      accountId: account.accountId,
      to: tenant.phone,
      templateKey: whatsAppTemplates.rentReceipt(),
      body: [tenant.fullName, formatNaira(input.amountKobo), receipt.number],
      documentUrl: this.receipts.documentUrl(receipt.id),
      documentName: `${receipt.number}.pdf`,
      dedupeKey: `receipt:${receipt.id}`,
    });
    return {
      sent: result.status === "SENT",
      reason: result.reason,
      caretakerRecorded: account.role === "CARETAKER",
      propertyName,
      unitLabel,
    };
  }

  private planAllocation(tenancy: Awaited<ReturnType<LedgerService["loadTenancy"]>>, input: RecordPayment) {
    if (input.category !== "RENT") {
      return {
        summary: `Records ${input.category.toLowerCase().replaceAll("_", " ")} of ${formatNaira(input.amountKobo)}.`,
        unallocatedKobo: 0,
        lines: [
          {
            chargeId: `draft:one-off:${input.idempotencyKey}`,
            dueDate: input.paidOn,
            amountKobo: input.amountKobo,
            label: input.category,
            draft: {
              kind: "ONE_OFF" as const,
              category: input.category,
              dueDate: input.paidOn,
              amountKobo: input.amountKobo,
              periodStart: null as string | null,
              periodEnd: null as string | null,
            },
          },
        ],
      };
    }
    const today = todayInLagos();
    const horizon = addCalendarMonths(today, MAX_ADVANCE_MONTHS);
    const drafts = generateCharges({
      startDate: calendarDate(tenancy.startDate),
      cycle: tenancy.cycle,
      rentAmountKobo: tenancy.rentAmountKobo,
      throughDate: horizon < calendarDate(tenancy.startDate) ? calendarDate(tenancy.startDate) : horizon,
      rates: ratesOf(tenancy),
    });
    const existingKeys = new Set(
      tenancy.charges.filter((charge) => charge.periodStart).map((charge) => calendarDate(charge.periodStart as Date)),
    );
    const open: (OpenCharge & { dueDate: string; label: string; draft?: DraftCharge })[] = tenancy.charges
      .filter((charge) => allocatedOf(charge) < charge.amountKobo)
      .map((charge) => ({
        id: charge.id,
        dueDate: calendarDate(charge.dueDate),
        amountKobo: charge.amountKobo,
        allocatedKobo: allocatedOf(charge),
        label: charge.kind === "ONE_OFF" ? "Opening arrears" : `Rent due ${calendarDate(charge.dueDate)}`,
      }));
    for (const draft of drafts) {
      if (draft.periodStart && existingKeys.has(draft.periodStart)) continue;
      const id = `draft:cycle:${draft.dueDate}`;
      open.push({
        id,
        dueDate: draft.dueDate,
        amountKobo: draft.amountKobo,
        allocatedKobo: 0,
        label: `Rent due ${draft.dueDate}`,
        draft: {
          kind: "CYCLE",
          category: "RENT",
          dueDate: draft.dueDate,
          amountKobo: draft.amountKobo,
          periodStart: draft.periodStart,
          periodEnd: draft.periodEnd,
        },
      });
    }
    const preview = previewAllocation({
      charges: open.map((charge) => ({
        id: charge.id,
        dueDate: charge.dueDate,
        amountKobo: charge.amountKobo,
        allocatedKobo: charge.allocatedKobo,
      })),
      amountKobo: input.amountKobo,
      asOf: input.paidOn,
    });
    const byId = new Map(open.map((charge) => [charge.id, charge]));
    return {
      summary: preview.summary,
      unallocatedKobo: preview.unallocatedKobo,
      lines: preview.lines.map((line) => {
        const charge = byId.get(line.chargeId);
        return {
          chargeId: line.chargeId,
          dueDate: charge?.dueDate ?? input.paidOn,
          amountKobo: line.amountKobo,
          label: charge?.label ?? "Rent",
          draft: charge?.draft,
        };
      }),
    };
  }

  private async persistDrafts(
    db: Db,
    accountId: string,
    tenancy: { id: string },
    lines: { chargeId: string; draft?: DraftCharge }[],
  ): Promise<Map<string, string>> {
    const ids = new Map<string, string>();
    for (const line of lines) {
      if (!line.chargeId.startsWith("draft:") || !line.draft) continue;
      if (ids.has(line.chargeId)) continue;
      if (line.draft.kind === "CYCLE" && line.draft.periodStart) {
        const existing = await db.charge.findFirst({
          where: {
            accountId,
            tenancyId: tenancy.id,
            kind: "CYCLE",
            periodStart: toDbDate(line.draft.periodStart),
          },
        });
        if (existing) {
          ids.set(line.chargeId, existing.id);
          continue;
        }
      }
      const created = await db.charge.create({
        data: {
          accountId,
          tenancyId: tenancy.id,
          kind: line.draft.kind,
          category: line.draft.category,
          periodStart: line.draft.periodStart ? toDbDate(line.draft.periodStart) : null,
          periodEnd: line.draft.periodEnd ? toDbDate(line.draft.periodEnd) : null,
          dueDate: toDbDate(line.draft.dueDate),
          amountKobo: line.draft.amountKobo,
        },
      });
      ids.set(line.chargeId, created.id);
    }
    return ids;
  }

  private async recomputeTenancy(db: Db, accountId: string, tenancyId: string): Promise<void> {
    const tenancy = await this.loadTenancy(db, accountId, tenancyId);
    for (const charge of tenancy.charges) {
      const allocated = allocatedOf(charge);
      const status = allocated <= 0 ? "UNPAID" : allocated >= charge.amountKobo ? "PAID" : "PART_PAID";
      await db.charge.update({ where: { id: charge.id }, data: { status } });
    }
    const cycles = tenancy.charges
      .filter((charge) => charge.kind === "CYCLE" && charge.periodEnd)
      .sort((left, right) => calendarDate(left.dueDate).localeCompare(calendarDate(right.dueDate)));
    let paidThrough: string | null = null;
    for (const charge of cycles) {
      const allocated = allocatedOf(charge);
      if (allocated < charge.amountKobo) break;
      paidThrough = calendarDate(charge.periodEnd as Date);
    }
    await db.tenancy.update({
      where: { id: tenancyId },
      data: { paidThrough: paidThrough ? toDbDate(paidThrough) : null },
    });
  }

  private duplicateWarning(tenancy: Awaited<ReturnType<LedgerService["loadTenancy"]>>, input: RecordPayment): boolean {
    return isDuplicatePayment(
      {
        tenancyId: tenancy.id,
        amountKobo: input.amountKobo,
        paidOn: input.paidOn,
        method: input.method as PaymentMethod,
        recordedAt: new Date().toISOString(),
      },
      tenancy.payments.map((payment) => ({
        tenancyId: tenancy.id,
        amountKobo: payment.amountKobo,
        paidOn: calendarDate(payment.paidOn),
        method: payment.method as PaymentMethod,
        recordedAt: payment.createdAt.toISOString(),
      })),
    );
  }

  private async loadTenancy(db: Db, accountId: string, tenancyId: string) {
    const tenancy = await db.tenancy.findFirst({
      where: { id: tenancyId, accountId, deletedAt: null },
      include: {
        tenant: true,
        unit: { include: { property: true, rentRates: true } },
        charges: { include: { allocations: { include: { payment: { include: { receipts: true } } } } } },
        payments: true,
      },
    });
    if (!tenancy) throw new NotFoundException("Tenancy not found.");
    return tenancy;
  }
}

type DraftCharge = {
  kind: "CYCLE" | "ONE_OFF";
  category: PaymentCategory;
  dueDate: string;
  amountKobo: number;
  periodStart: string | null;
  periodEnd: string | null;
};

function allocatedOf(charge: ChargeRow): number {
  return charge.allocations.reduce((sum, allocation) => {
    const receipts = allocation.payment.receipts;
    const counts = receipts.length === 0 || receipts.some((receipt) => receipt.status === "ISSUED");
    return counts ? sum + allocation.amountKobo : sum;
  }, 0);
}

function ratesOf(tenancy: { rentAmountKobo: number; unit: { rentRates: { effectiveFrom: Date; amountKobo: number }[] } }) {
  const rates = tenancy.unit.rentRates.map((rate) => ({
    effectiveFrom: calendarDate(rate.effectiveFrom),
    amountKobo: rate.amountKobo,
  }));
  if (rates.length === 0) return undefined;
  return rates;
}

function daysInclusive(start: string, end: string): number {
  const ms = Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`);
  return Math.round(ms / 86_400_000) + 1;
}
