import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { recordPaymentSchema, voidReceiptSchema } from "@rae/schemas";
import { CurrentAccount, type AccountContext } from "../../common/account-context";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { calendarDate } from "../../common/dates";
import { LedgerService } from "./ledger.service";

@ApiTags("payments")
@ApiBearerAuth()
@Controller("payments")
export class LedgerController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@CurrentAccount() account: AccountContext) {
    const db = await this.prisma.db();
    const payments = await db.payment.findMany({
      where: { accountId: account.accountId },
      include: { tenancy: { include: { tenant: true, unit: true } }, receipts: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return payments.map((payment) => ({
      id: payment.id,
      tenancyId: payment.tenancyId,
      tenant: payment.tenancy.tenant.fullName,
      unit: payment.tenancy.unit.label,
      amountKobo: payment.amountKobo,
      paidOn: calendarDate(payment.paidOn),
      method: payment.method,
      category: payment.category,
      note: payment.note,
      receipt: payment.receipts.find((receipt) => receipt.status === "ISSUED") ?? null,
    }));
  }

  @Post("preview")
  preview(
    @CurrentAccount() account: AccountContext,
    @Body(new ZodValidationPipe(recordPaymentSchema)) body: ReturnType<typeof recordPaymentSchema.parse>,
  ) {
    return this.ledger.preview(account, body);
  }

  @Post()
  record(
    @CurrentAccount() account: AccountContext,
    @Body(new ZodValidationPipe(recordPaymentSchema)) body: ReturnType<typeof recordPaymentSchema.parse>,
  ) {
    return this.ledger.record(account, body);
  }

  @Post("receipts/:id/void")
  voidReceipt(
    @CurrentAccount() account: AccountContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(voidReceiptSchema)) body: ReturnType<typeof voidReceiptSchema.parse>,
  ) {
    return this.ledger.voidReceipt(account, id, body);
  }
}
