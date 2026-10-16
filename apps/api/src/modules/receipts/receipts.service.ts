import { Injectable, NotFoundException } from "@nestjs/common";
import { formatReceiptNumber, receiptNumberPrefix, sha256Hex } from "@rae/domain";
import { apiPublicUrl, webOrigin } from "../../config/env";
import { sha256Bytes } from "../../common/crypto";
import { signReceiptToken } from "../../common/tokens";
import { PrismaService } from "../../prisma/prisma.service";
import { StorageService } from "../../storage/storage.service";
import type { Db } from "../../prisma/types";
import { renderReceiptPdf } from "./receipt-pdf";

export interface IssueReceiptInput {
  accountId: string;
  accountCode: string;
  paymentId: string;
  issuedOn: string;
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  amountKobo: number;
  method: string;
  category: string;
  summary: string;
}

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async issue(db: Db, input: IssueReceiptInput): Promise<{ id: string; number: string; publicPath: string }> {
    const prefix = receiptNumberPrefix(input.accountCode, input.issuedOn);
    const existingCount = await db.receipt.count({ where: { number: { startsWith: prefix } } });
    const number = formatReceiptNumber({
      accountCode: input.accountCode,
      issuedOn: input.issuedOn,
      sequence: existingCount + 1,
    });
    const receipt = await db.receipt.create({
      data: {
        accountId: input.accountId,
        paymentId: input.paymentId,
        number,
        status: "ISSUED",
        storageKey: "pending",
        sha256: "pending",
      },
    });
    const token = signReceiptToken(receipt.id);
    const bytes = await renderReceiptPdf({
      number,
      tenantName: input.tenantName,
      propertyName: input.propertyName,
      unitLabel: input.unitLabel,
      amountKobo: input.amountKobo,
      paidOn: input.issuedOn,
      method: input.method,
      category: input.category,
      summary: input.summary,
      confirmUrl: `${webOrigin()}/receipt/${token}`,
    });
    const hash = await sha256Hex(bytes).catch(() => sha256Bytes(bytes));
    const storageKey = `accounts/${input.accountId}/receipts/${receipt.id}.pdf`;
    await this.storage.put(storageKey, bytes, "application/pdf");
    await db.receipt.update({ where: { id: receipt.id }, data: { storageKey, sha256: hash } });
    return { id: receipt.id, number, publicPath: `/receipt/${token}` };
  }

  async fileForAccount(accountId: string, receiptId: string): Promise<{ bytes: Uint8Array; number: string }> {
    const db = await this.prisma.db();
    const receipt = await db.receipt.findFirst({ where: { id: receiptId, accountId } });
    if (!receipt) throw new NotFoundException("Receipt not found.");
    return { bytes: await this.storage.get(receipt.storageKey), number: receipt.number };
  }

  async filePublic(receiptId: string): Promise<{ bytes: Uint8Array; number: string }> {
    const db = await this.prisma.db();
    const receipt = await db.receipt.findUnique({ where: { id: receiptId } });
    if (!receipt || receipt.storageKey === "pending") throw new NotFoundException("Receipt not found.");
    return { bytes: await this.storage.get(receipt.storageKey), number: receipt.number };
  }

  documentUrl(receiptId: string): string | undefined {
    const base = apiPublicUrl();
    if (!base.startsWith("https://")) return undefined;
    return `${base}/api/public/receipts/${signReceiptToken(receiptId)}/file`;
  }
}
