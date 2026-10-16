import { Controller, Get, Header, Param, Post, Res, StreamableFile } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentAccount, type AccountContext } from "../../common/account-context";
import { calendarDate } from "../../common/dates";
import { signReceiptToken } from "../../common/tokens";
import { PrismaService } from "../../prisma/prisma.service";
import { webOrigin } from "../../config/env";
import { whatsAppTemplates } from "../../config/whatsapp-templates";
import { ReceiptsService } from "./receipts.service";
import { MessagingService } from "../messaging/messaging.service";
import { PlansService } from "../plans/plans.service";
import { formatNaira } from "@rae/domain";

@ApiTags("receipts")
@ApiBearerAuth()
@Controller("receipts")
export class ReceiptsController {
  constructor(
    private readonly receipts: ReceiptsService,
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly plans: PlansService,
  ) {}

  @Get()
  async list(@CurrentAccount() account: AccountContext) {
    const db = await this.prisma.db();
    const rows = await db.receipt.findMany({
      where: { accountId: account.accountId },
      include: { payment: { include: { tenancy: { include: { tenant: true, unit: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map((receipt) => ({
      id: receipt.id,
      number: receipt.number,
      status: receipt.status,
      amountKobo: receipt.payment.amountKobo,
      paidOn: calendarDate(receipt.payment.paidOn),
      tenant: receipt.payment.tenancy.tenant.fullName,
      unit: receipt.payment.tenancy.unit.label,
      publicPath: `/receipt/${signReceiptToken(receipt.id)}`,
    }));
  }

  @Get(":id/file")
  @Header("Content-Type", "application/pdf")
  async file(@CurrentAccount() account: AccountContext, @Param("id") id: string, @Res({ passthrough: true }) response: Response) {
    const file = await this.receipts.fileForAccount(account.accountId, id);
    response.setHeader("Content-Disposition", `inline; filename="${file.number}.pdf"`);
    return new StreamableFile(Buffer.from(file.bytes));
  }

  @Post(":id/resend")
  async resend(@CurrentAccount() account: AccountContext, @Param("id") id: string) {
    const plan = await this.plans.limits(account.accountId);
    if (!plan.whatsappEnabled) {
      return { sent: false, reason: "WhatsApp receipts are included on Standard and Pro. Download the PDF instead." };
    }
    const db = await this.prisma.db();
    const receipt = await db.receipt.findFirst({
      where: { id, accountId: account.accountId, status: "ISSUED" },
      include: { payment: { include: { tenancy: { include: { tenant: true } } } } },
    });
    if (!receipt) return { sent: false, reason: "Receipt not found." };
    const tenant = receipt.payment.tenancy.tenant;
    if (!tenant.whatsappConsent || tenant.whatsappOptedOutAt) {
      return { sent: false, reason: "This tenant has not agreed to WhatsApp messages." };
    }
    const result = await this.messaging.sendTemplate({
      accountId: account.accountId,
      to: tenant.phone,
      templateKey: whatsAppTemplates.rentReceipt(),
      body: [tenant.fullName, formatNaira(receipt.payment.amountKobo), receipt.number],
      documentUrl: this.receipts.documentUrl(receipt.id),
      documentName: `${receipt.number}.pdf`,
    });
    return { sent: result.status === "SENT", reason: result.reason, shareUrl: `${webOrigin()}/receipt/${signReceiptToken(receipt.id)}` };
  }
}
