import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { formatNaira } from "@rae/domain";
import { CurrentAccount, type AccountContext } from "../../common/account-context";
import { calendarDate, todayInLagos } from "../../common/dates";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("reports")
@ApiBearerAuth()
@Controller("reports")
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("income")
  async income(@CurrentAccount() account: AccountContext, @Query("format") format: string | undefined, @Res({ passthrough: true }) response: Response) {
    const db = await this.prisma.db();
    const [payments, charges] = await Promise.all([
      db.payment.findMany({
        where: { accountId: account.accountId },
        include: { tenancy: { include: { unit: { include: { property: true } } } } },
      }),
      db.charge.findMany({ where: { accountId: account.accountId }, include: { tenancy: { include: { unit: { include: { property: true } } } } } }),
    ]);
    const year = todayInLagos().slice(0, 4);
    const rows = new Map<string, { month: string; property: string; expectedKobo: number; collectedKobo: number }>();
    for (const charge of charges) {
      const month = calendarDate(charge.dueDate).slice(0, 7);
      if (!month.startsWith(year)) continue;
      const property = charge.tenancy.unit.property.name;
      const key = `${month}:${property}`;
      const row = rows.get(key) ?? { month, property, expectedKobo: 0, collectedKobo: 0 };
      row.expectedKobo += charge.amountKobo;
      rows.set(key, row);
    }
    for (const payment of payments) {
      const month = calendarDate(payment.paidOn).slice(0, 7);
      if (!month.startsWith(year)) continue;
      const property = payment.tenancy.unit.property.name;
      const key = `${month}:${property}`;
      const row = rows.get(key) ?? { month, property, expectedKobo: 0, collectedKobo: 0 };
      row.collectedKobo += payment.amountKobo;
      rows.set(key, row);
    }
    const list = [...rows.values()].sort((left, right) => left.month.localeCompare(right.month) || left.property.localeCompare(right.property));
    if (format === "csv") {
      const csv = ["month,property,expected,collected", ...list.map((row) => `${row.month},"${row.property.replaceAll('"', '""')}",${formatNaira(row.expectedKobo).replace("₦", "")},${formatNaira(row.collectedKobo).replace("₦", "")}`)].join("\n");
      response.setHeader("Content-Type", "text/csv; charset=utf-8");
      response.setHeader("Content-Disposition", `attachment; filename="rent-at-ease-${year}.csv"`);
      return csv;
    }
    return { year, rows: list.map((row) => ({ ...row, expected: formatNaira(row.expectedKobo), collected: formatNaira(row.collectedKobo) })) };
  }
}
