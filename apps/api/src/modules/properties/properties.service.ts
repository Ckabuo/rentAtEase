import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { canAddUnit } from "@rae/domain";
import type { CreateProperty, CreateUnit, UpdateProperty } from "@rae/schemas";
import type { AccountContext } from "../../common/account-context";
import { toDbDate } from "../../common/dates";
import { assertOwner } from "../../common/roles";
import { webOrigin } from "../../config/env";
import { signInvite } from "../../common/tokens";
import { AuditService } from "../audit/audit.service";
import { PlansService } from "../plans/plans.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly audit: AuditService,
  ) {}

  async list(accountId: string) {
    const db = await this.prisma.db();
    return db.property.findMany({
      where: { accountId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        units: {
          where: { deletedAt: null },
          include: { rentRates: { orderBy: { effectiveFrom: "desc" }, take: 1 } },
        },
      },
    });
  }

  async createProperty(account: AccountContext, input: CreateProperty) {
    assertOwner(account);
    const db = await this.prisma.db();
    const property = await db.property.create({ data: { accountId: account.accountId, ...input } });
    await this.audit.write(db, {
      accountId: account.accountId,
      actorUserId: account.userId,
      action: "PROPERTY_CREATED",
      entityType: "Property",
      entityId: property.id,
      after: { name: property.name },
    });
    return property;
  }

  async updateProperty(account: AccountContext, propertyId: string, input: UpdateProperty) {
    assertOwner(account);
    const db = await this.prisma.db();
    const existing = await db.property.findFirst({
      where: { id: propertyId, accountId: account.accountId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Property not found.");
    const property = await db.property.update({
      where: { id: propertyId },
      data: {
        name: input.name,
        addressLine: input.addressLine,
        city: input.city,
        state: input.state,
        description: input.description ?? null,
      },
    });
    await this.audit.write(db, {
      accountId: account.accountId,
      actorUserId: account.userId,
      action: "PROPERTY_UPDATED",
      entityType: "Property",
      entityId: property.id,
      after: { name: property.name },
    });
    return property;
  }

  async deleteProperty(account: AccountContext, propertyId: string) {
    assertOwner(account);
    const db = await this.prisma.db();
    const property = await db.property.findFirst({
      where: { id: propertyId, accountId: account.accountId, deletedAt: null },
      include: { units: { where: { deletedAt: null } } },
    });
    if (!property) throw new NotFoundException("Property not found.");
    if (property.units.some((unit) => unit.status === "OCCUPIED")) {
      throw new BadRequestException("Move out tenants before deleting a property with occupied units.");
    }
    const now = new Date();
    await db.$transaction([
      db.unit.updateMany({
        where: { propertyId: property.id, accountId: account.accountId, deletedAt: null },
        data: { deletedAt: now },
      }),
      db.property.update({ where: { id: property.id }, data: { deletedAt: now } }),
    ]);
    await this.audit.write(db, {
      accountId: account.accountId,
      actorUserId: account.userId,
      action: "PROPERTY_DELETED",
      entityType: "Property",
      entityId: property.id,
      before: { name: property.name },
    });
    return { ok: true };
  }

  async createUnit(account: AccountContext, input: CreateUnit) {
    assertOwner(account);
    const db = await this.prisma.db();
    const property = await db.property.findFirst({
      where: { id: input.propertyId, accountId: account.accountId, deletedAt: null },
    });
    if (!property) throw new NotFoundException("Property not found.");
    const plan = await this.plans.limits(account.accountId);
    const currentUnits = await db.unit.count({ where: { accountId: account.accountId, deletedAt: null } });
    if (!canAddUnit(plan.code, currentUnits)) {
      throw new BadRequestException(`${plan.name} allows ${plan.unitLimit} units. Move to a higher plan to add more.`);
    }
    const unit = await db.unit.create({
      data: {
        accountId: account.accountId,
        propertyId: property.id,
        label: input.label,
        type: input.type,
      },
    });
    await db.rentRate.create({
      data: {
        accountId: account.accountId,
        unitId: unit.id,
        amountKobo: input.rentAmountKobo,
        cycle: input.cycle,
        effectiveFrom: toDbDate(input.effectiveFrom),
      },
    });
    await this.audit.write(db, {
      accountId: account.accountId,
      actorUserId: account.userId,
      action: "UNIT_CREATED",
      entityType: "Unit",
      entityId: unit.id,
      after: { label: unit.label, rentAmountKobo: input.rentAmountKobo, cycle: input.cycle },
    });
    return { ...unit, rentAmountKobo: input.rentAmountKobo, cycle: input.cycle };
  }

  async publicUnit(accountId: string, unitId: string) {
    const db = await this.prisma.db();
    const unit = await db.unit.findFirst({
      where: { id: unitId, accountId, deletedAt: null },
      include: { property: true, rentRates: { orderBy: { effectiveFrom: "desc" }, take: 1 } },
    });
    if (!unit || unit.status !== "VACANT") throw new NotFoundException("This unit is not open for applications.");
    return {
      property: unit.property.name,
      unit: unit.label,
      city: unit.property.city,
      unitType: unit.type,
      rentAmountKobo: unit.rentRates[0]?.amountKobo ?? 0,
      cycle: unit.rentRates[0]?.cycle ?? "ANNUAL",
    };
  }

  async applicationLink(account: AccountContext, unitId: string) {
    assertOwner(account);
    const db = await this.prisma.db();
    const unit = await db.unit.findFirst({
      where: { id: unitId, accountId: account.accountId, deletedAt: null, status: "VACANT" },
      include: { property: true },
    });
    if (!unit) throw new NotFoundException("Choose a vacant unit.");
    const token = signInvite(account.accountId, unit.id);
    return {
      url: `${webOrigin()}/apply/${token}`,
      unit: unit.label,
      property: unit.property.name,
    };
  }
}
