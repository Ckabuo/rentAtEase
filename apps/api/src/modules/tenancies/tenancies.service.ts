import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { rentStatus, type RentStatus } from "@rae/domain";
import type { CreateTenancy, CreateTenant, MoveOut, UpdateTenant } from "@rae/schemas";
import type { AccountContext } from "../../common/account-context";
import { outstandingKoboOf } from "../../common/charge-outstanding";
import { calendarDate, todayInLagos, toDbDate } from "../../common/dates";
import { assertOwner } from "../../common/roles";
import { AuditService } from "../audit/audit.service";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TenanciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  async list(accountId: string) {
    const db = await this.prisma.db();
    const today = todayInLagos();
    const [tenancies, tenants, units] = await Promise.all([
      db.tenancy.findMany({
        where: { accountId, deletedAt: null, tenant: { deletedAt: null } },
        include: {
          tenant: true,
          unit: { include: { property: true } },
          charges: { include: { allocations: { include: { payment: { include: { receipts: true } } } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.tenant.findMany({ where: { accountId, deletedAt: null }, orderBy: { fullName: "asc" } }),
      db.unit.findMany({
        where: { accountId, deletedAt: null },
        include: { property: true, rentRates: { orderBy: { effectiveFrom: "desc" }, take: 1 } },
      }),
    ]);
    return {
      tenancies: tenancies.map((tenancy) => {
        const ended = tenancy.endDate != null;
        const summary = ended ? null : tenancyRentSummary(tenancy.charges, today);
        return {
          id: tenancy.id,
          tenantId: tenancy.tenantId,
          tenantName: tenancy.tenant.fullName,
          phone: tenancy.tenant.phone,
          whatsappConsent: tenancy.tenant.whatsappConsent,
          whatsappOptedOutAt: tenancy.tenant.whatsappOptedOutAt?.toISOString() ?? null,
          property: tenancy.unit.property.name,
          propertyId: tenancy.unit.property.id,
          unit: tenancy.unit.label,
          unitId: tenancy.unitId,
          cycle: tenancy.cycle,
          rentAmountKobo: tenancy.rentAmountKobo,
          startDate: calendarDate(tenancy.startDate),
          paidThrough: tenancy.paidThrough ? calendarDate(tenancy.paidThrough) : null,
          endDate: tenancy.endDate ? calendarDate(tenancy.endDate) : null,
          rentStatus: summary?.status ?? null,
          outstandingKobo: summary?.outstandingKobo ?? 0,
        };
      }),
      tenants,
      units: units.map((unit) => ({
        id: unit.id,
        label: unit.label,
        status: unit.status,
        property: unit.property.name,
        rentAmountKobo: unit.rentRates[0]?.amountKobo ?? 0,
        cycle: unit.rentRates[0]?.cycle ?? "ANNUAL",
      })),
    };
  }

  async createTenant(account: AccountContext, input: CreateTenant) {
    assertOwner(account);
    const db = await this.prisma.db();
    const tenant = await db.tenant.create({
      data: {
        accountId: account.accountId,
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        whatsappConsent: input.whatsappConsent,
      },
    });
    if (input.whatsappConsent) {
      await db.consentRecord.create({
        data: { accountId: account.accountId, subject: "TENANT_WHATSAPP", noticeVersion: "2026-10" },
      });
    }
    await this.audit.write(db, {
      accountId: account.accountId,
      actorUserId: account.userId,
      action: "TENANT_CREATED",
      entityType: "Tenant",
      entityId: tenant.id,
      after: { fullName: tenant.fullName },
    });
    return tenant;
  }

  async updateTenant(account: AccountContext, tenantId: string, input: UpdateTenant) {
    assertOwner(account);
    const db = await this.prisma.db();
    const existing = await db.tenant.findFirst({
      where: { id: tenantId, accountId: account.accountId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Tenant not found.");
    let whatsappOptedOutAt = existing.whatsappOptedOutAt;
    if (input.whatsappConsent) {
      whatsappOptedOutAt = null;
    } else if (existing.whatsappConsent) {
      whatsappOptedOutAt = new Date();
    }
    const tenant = await db.tenant.update({
      where: { id: tenantId },
      data: {
        fullName: input.fullName,
        phone: input.phone,
        email: input.email ?? null,
        whatsappConsent: input.whatsappConsent,
        whatsappOptedOutAt,
      },
    });
    if (input.whatsappConsent && !existing.whatsappConsent) {
      await db.consentRecord.create({
        data: { accountId: account.accountId, subject: "TENANT_WHATSAPP", noticeVersion: "2026-10" },
      });
    }
    await this.audit.write(db, {
      accountId: account.accountId,
      actorUserId: account.userId,
      action: "TENANT_UPDATED",
      entityType: "Tenant",
      entityId: tenant.id,
      after: { fullName: tenant.fullName },
    });
    return tenant;
  }

  async deleteTenant(account: AccountContext, tenantId: string) {
    assertOwner(account);
    const db = await this.prisma.db();
    const tenant = await db.tenant.findFirst({
      where: { id: tenantId, accountId: account.accountId, deletedAt: null },
    });
    if (!tenant) throw new NotFoundException("Tenant not found.");
    const activeTenancy = await db.tenancy.findFirst({
      where: { tenantId, accountId: account.accountId, deletedAt: null, endDate: null },
    });
    if (activeTenancy) {
      throw new BadRequestException("Record move-out before removing this tenant.");
    }
    await db.tenant.update({ where: { id: tenantId }, data: { deletedAt: new Date() } });
    await this.audit.write(db, {
      accountId: account.accountId,
      actorUserId: account.userId,
      action: "TENANT_DELETED",
      entityType: "Tenant",
      entityId: tenant.id,
      before: { fullName: tenant.fullName },
    });
    return { ok: true };
  }

  async createTenancy(account: AccountContext, input: CreateTenancy) {
    assertOwner(account);
    const db = await this.prisma.db();
    const [tenant, unit] = await Promise.all([
      db.tenant.findFirst({ where: { id: input.tenantId, accountId: account.accountId, deletedAt: null } }),
      db.unit.findFirst({ where: { id: input.unitId, accountId: account.accountId, deletedAt: null } }),
    ]);
    if (!tenant || !unit) throw new NotFoundException("Tenant or unit not found.");
    if (unit.status !== "VACANT") throw new BadRequestException("That unit is already occupied.");
    const tenancy = await db.$transaction(async (tx) => {
      const client = tx as unknown as Parameters<LedgerService["openTenancy"]>[0];
      const occupied = await client.unit.updateMany({
        where: { id: unit.id, accountId: account.accountId, status: "VACANT" },
        data: { status: "OCCUPIED" },
      });
      if (occupied.count !== 1) throw new BadRequestException("That unit was just taken.");
      const created = await client.tenancy.create({
        data: {
          accountId: account.accountId,
          tenantId: tenant.id,
          unitId: unit.id,
          startDate: toDbDate(input.startDate),
          endDate: input.endDate ? toDbDate(input.endDate) : null,
          cycle: input.cycle,
          rentAmountKobo: input.rentAmountKobo,
          openingArrearsKobo: input.openingArrearsKobo,
        },
      });
      await client.rentRate.upsert({
        where: { unitId_effectiveFrom: { unitId: unit.id, effectiveFrom: toDbDate(input.startDate) } },
        update: { amountKobo: input.rentAmountKobo, cycle: input.cycle },
        create: {
          accountId: account.accountId,
          unitId: unit.id,
          amountKobo: input.rentAmountKobo,
          cycle: input.cycle,
          effectiveFrom: toDbDate(input.startDate),
        },
      });
      await this.ledger.openTenancy(client, {
        accountId: account.accountId,
        userId: account.userId,
        tenancyId: created.id,
        paidThrough: input.paidThrough,
        openingArrearsKobo: input.openingArrearsKobo,
      });
      await this.audit.write(client, {
        accountId: account.accountId,
        actorUserId: account.userId,
        action: "TENANCY_STARTED",
        entityType: "Tenancy",
        entityId: created.id,
        after: { tenant: tenant.fullName, unit: unit.label, startDate: input.startDate },
      });
      return created;
    });
    return tenancy;
  }

  async moveOut(account: AccountContext, tenancyId: string, input: MoveOut) {
    assertOwner(account);
    const db = await this.prisma.db();
    const tenancy = await db.tenancy.findFirst({
      where: { id: tenancyId, accountId: account.accountId, deletedAt: null, endDate: null },
    });
    if (!tenancy) throw new NotFoundException("Active tenancy not found.");
    await db.$transaction(async (tx) => {
      await tx.tenancy.update({ where: { id: tenancy.id }, data: { endDate: toDbDate(input.endDate) } });
      await tx.unit.updateMany({
        where: { id: tenancy.unitId, accountId: account.accountId },
        data: { status: "VACANT" },
      });
      await this.audit.write(tx as unknown as Parameters<LedgerService["openTenancy"]>[0], {
        accountId: account.accountId,
        actorUserId: account.userId,
        action: "TENANCY_ENDED",
        entityType: "Tenancy",
        entityId: tenancy.id,
        after: { endDate: input.endDate },
      });
    });
    return { ended: true };
  }
}

function tenancyRentSummary(
  charges: {
    dueDate: Date;
    amountKobo: number;
    status: "UNPAID" | "PART_PAID" | "PAID";
    allocations: { amountKobo: number; payment: { receipts: { status: string }[] } }[];
  }[],
  today: string,
): { status: RentStatus; outstandingKobo: number } {
  const open = charges
    .map((charge) => ({ charge, outstanding: outstandingKoboOf(charge) }))
    .filter((item) => item.outstanding > 0)
    .sort((left, right) => calendarDate(left.charge.dueDate).localeCompare(calendarDate(right.charge.dueDate)));
  const next = open[0];
  if (!next) return { status: "PAID", outstandingKobo: 0 };
  const result = rentStatus({
    today,
    dueDate: calendarDate(next.charge.dueDate),
    chargeStatus: next.charge.status,
    outstandingKobo: next.outstanding,
  });
  const outstandingKobo = open.reduce((sum, item) => sum + item.outstanding, 0);
  return { status: result.status, outstandingKobo };
}
