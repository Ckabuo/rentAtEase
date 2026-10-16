import { Injectable } from "@nestjs/common";
import { daysBetween, formatNaira, rentStatus } from "@rae/domain";
import type { AccountContext } from "../../common/account-context";
import { calendarDate, todayInLagos } from "../../common/dates";
import { PlansService } from "../plans/plans.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
  ) {}

  async get(account: AccountContext) {
    const db = await this.prisma.db();
    const today = todayInLagos();
    const year = today.slice(0, 4);
    const [properties, units, tenancies, applications, payments, audits, messages] = await Promise.all([
      db.property.count({ where: { accountId: account.accountId, deletedAt: null } }),
      db.unit.findMany({ where: { accountId: account.accountId, deletedAt: null }, include: { property: true, rentRates: { take: 1, orderBy: { effectiveFrom: "desc" } } } }),
      db.tenancy.findMany({
        where: { accountId: account.accountId, deletedAt: null, endDate: null },
        include: {
          tenant: true,
          unit: { include: { property: true } },
          charges: { include: { allocations: { include: { payment: { include: { receipts: true } } } } } },
        },
      }),
      db.application.findMany({
        where: { accountId: account.accountId, status: { in: ["SUBMITTED", "INFO_REQUESTED"] } },
        include: { applicant: true, unit: { include: { property: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      db.payment.findMany({ where: { accountId: account.accountId }, orderBy: { paidOn: "desc" } }),
      db.auditLog.findMany({ where: { accountId: account.accountId }, orderBy: { createdAt: "desc" }, take: 8 }),
      db.tenant.count({ where: { accountId: account.accountId, deletedAt: null, whatsappConsent: true, whatsappOptedOutAt: null } }),
    ]);

    const occupied = units.filter((unit) => unit.status === "OCCUPIED").length;
    const collectedThisYear = payments
      .filter((payment) => calendarDate(payment.paidOn).startsWith(year))
      .reduce((sum, payment) => sum + payment.amountKobo, 0);
    const rows = tenancies.map((tenancy) => this.tenantRow(tenancy, today));
    const vacantRows = units
      .filter((unit) => unit.status === "VACANT")
      .map((unit) => ({
        id: unit.id,
        tenancyId: null as string | null,
        initials: "—",
        name: `${unit.label} (Vacant)`,
        property: unit.property.name,
        unit: unit.label,
        rent: formatNaira(unit.rentRates[0]?.amountKobo ?? 0),
        status: "vacant" as const,
        statusLabel: "Vacant",
      }));
    const outstanding = rows.reduce((sum, row) => sum + row.outstandingKobo, 0);
    const overdueCount = rows.filter((row) => row.status === "overdue").length;
    const dueThisMonth = rows.filter((row) => row.dueThisMonth).length;
    const preview = properties === 0 && tenancies.length === 0;
    const plan = await this.plans.limits(account.accountId);
    const months = this.months(payments, tenancies, today);

    return {
      preview,
      planCode: plan.code,
      planName: plan.name,
      checklist: [
        { id: "property", title: "Add a property and units", description: "Unit type, rent amount and cycle (annual, bi-annual or monthly).", done: properties > 0, href: "/properties", actionLabel: "Add property" },
        { id: "tenants", title: "Add tenants or share an application link", description: "Existing tenants: include paid-up-to date and any arrears.", done: tenancies.length > 0, href: "/tenants", actionLabel: "Add tenants" },
        { id: "payment", title: "Record your first payment", description: "Preview how rent applies before you confirm; receipt follows.", done: payments.length > 0, href: "/payments", actionLabel: "Record payment" },
        { id: "reminders", title: "Turn on WhatsApp reminders", description: "Only after each tenant has agreed — you stay in control.", done: messages > 0, href: "/reminders", actionLabel: "Reminder settings" },
      ],
      stats: [
        { label: `Total collected (${year})`, value: formatCompact(collectedThisYear), change: `${payments.length} payments recorded`, tone: "teal", changeTone: "up" },
        { label: "Outstanding rent", value: formatCompact(outstanding), change: overdueCount ? `${overdueCount} overdue` : "No overdue rent", tone: "amber", changeTone: overdueCount ? "down" : "muted" },
        { label: "Occupied units", value: `${occupied}/${units.length}`, change: units.length ? `${Math.round((occupied / units.length) * 100)}% occupancy` : "No units yet", tone: "green", changeTone: "up" },
        { label: "Due this month", value: String(dueThisMonth), change: `${applications.length} applications waiting`, tone: "red", changeTone: "muted" },
      ],
      tenants: [...rows.map(({ outstandingKobo: _ignored, dueThisMonth: _due, ...row }) => row), ...vacantRows],
      months,
      applicants: applications.map((application) => ({
        id: application.id,
        initials: initials(application.applicant.fullName),
        name: application.applicant.fullName,
        detail: `${application.unit.property.name} ${application.unit.label}`,
        score: application.score ?? 0,
        verdict: verdict(application.recommendation),
        tone: tone(application.recommendation),
      })),
      activity: audits.map((entry) => ({
        id: entry.id,
        title: titleFor(entry.action),
        detail: detailFor(entry.after),
        time: entry.createdAt.toISOString(),
        tone: toneFor(entry.action),
      })),
      notices: rows.filter((row) => row.status === "overdue").map((row) => `${row.name} is overdue on ${row.unit}`),
      subtitle: `${occupied} occupied units across ${properties} properties`,
    };
  }

  private tenantRow(
    tenancy: {
      id: string;
      rentAmountKobo: number;
      tenant: { fullName: string };
      unit: { label: string; property: { name: string } };
      charges: { dueDate: Date; amountKobo: number; status: "UNPAID" | "PART_PAID" | "PAID"; allocations: { amountKobo: number; payment: { receipts: { status: string }[] } }[] }[];
    },
    today: string,
  ) {
    const open = tenancy.charges
      .map((charge) => {
        const allocated = charge.allocations.reduce((sum, allocation) => {
          const receipts = allocation.payment.receipts;
          const counts = receipts.length === 0 || receipts.some((receipt) => receipt.status === "ISSUED");
          return counts ? sum + allocation.amountKobo : sum;
        }, 0);
        return { ...charge, outstanding: Math.max(0, charge.amountKobo - allocated) };
      })
      .filter((charge) => charge.outstanding > 0)
      .sort((left, right) => calendarDate(left.dueDate).localeCompare(calendarDate(right.dueDate)));
    const next = open[0];
    const status = next
      ? rentStatus({
          today,
          dueDate: calendarDate(next.dueDate),
          chargeStatus: next.status,
          outstandingKobo: next.outstanding,
        }).status
      : "PAID";
    const dueDate = next ? calendarDate(next.dueDate) : null;
    const days = dueDate ? daysBetween(dueDate, today) : 0;
    const label =
      status === "PAID"
        ? "Paid"
        : status === "PART_PAID"
          ? "Part-paid"
          : status === "OVERDUE"
            ? `Overdue ${days} days`
            : dueDate
              ? `Due in ${Math.max(0, daysBetween(today, dueDate))} days`
              : "Due soon";
    return {
      id: tenancy.id,
      tenancyId: tenancy.id,
      initials: initials(tenancy.tenant.fullName),
      name: tenancy.tenant.fullName,
      property: tenancy.unit.property.name,
      unit: tenancy.unit.label,
      rent: formatNaira(tenancy.rentAmountKobo),
      status: status === "PAID" ? "paid" : status === "OVERDUE" ? "overdue" : status === "PART_PAID" ? "part" : "due",
      statusLabel: label,
      outstandingKobo: open.reduce((sum, charge) => sum + charge.outstanding, 0),
      dueThisMonth: Boolean(dueDate && dueDate.slice(0, 7) === today.slice(0, 7) && status !== "PAID"),
    };
  }

  private months(
    payments: { paidOn: Date; amountKobo: number }[],
    tenancies: { charges: { dueDate: Date; amountKobo: number }[] }[],
    today: string,
  ) {
    const points: { label: string; collectedKobo: number; expectedKobo: number }[] = [];
    const cursor = new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`);
    for (let index = 8; index >= 0; index -= 1) {
      const date = new Date(cursor);
      date.setUTCMonth(date.getUTCMonth() - index);
      const key = date.toISOString().slice(0, 7);
      const collectedKobo = payments
        .filter((payment) => calendarDate(payment.paidOn).startsWith(key))
        .reduce((sum, payment) => sum + payment.amountKobo, 0);
      const expectedKobo = tenancies
        .flatMap((tenancy) => tenancy.charges)
        .filter((charge) => calendarDate(charge.dueDate).startsWith(key))
        .reduce((sum, charge) => sum + charge.amountKobo, 0);
      points.push({
        label: date.toLocaleString("en-GB", { month: "short", timeZone: "UTC" }),
        collectedKobo,
        expectedKobo,
      });
    }
    const max = Math.max(1, ...points.flatMap((point) => [point.collectedKobo, point.expectedKobo]));
    return points.map((point) => ({
      label: point.label,
      collected: Math.round((point.collectedKobo / max) * 100),
      expected: Math.round((point.expectedKobo / max) * 100),
      collectedLabel: formatNaira(point.collectedKobo),
      expectedLabel: formatNaira(point.expectedKobo),
    }));
  }
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatCompact(kobo: number): string {
  const naira = Math.round(kobo / 100);
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (naira >= 1_000) return `₦${Math.round(naira / 1_000)}K`;
  return formatNaira(kobo);
}

function verdict(recommendation: string | null): string {
  if (recommendation === "APPROVE") return "Approve";
  if (recommendation === "DECLINE") return "Decline";
  return "Review";
}

function tone(recommendation: string | null): "high" | "mid" | "low" {
  if (recommendation === "APPROVE") return "high";
  if (recommendation === "DECLINE") return "low";
  return "mid";
}

function titleFor(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function detailFor(after: unknown): string {
  if (!after || typeof after !== "object") return "Recorded in the audit log";
  const record = after as Record<string, unknown>;
  return Object.values(record)
    .filter((value) => typeof value === "string" || typeof value === "number")
    .slice(0, 3)
    .join(" · ");
}

function toneFor(action: string): string {
  if (action.includes("VOID") || action.includes("DECLIN") || action.includes("OVERDUE")) return "bg-danger-light";
  if (action.includes("PAYMENT") || action.includes("RECEIPT")) return "bg-success-light";
  if (action.includes("APPLICATION")) return "bg-teal-light";
  return "bg-amber-light";
}
