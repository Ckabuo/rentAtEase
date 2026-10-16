import { Body, Controller, Get, Header, Ip, Param, Post, Res, StreamableFile } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HttpException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { submitApplicationSchema } from "@rae/schemas";
import type { Response } from "express";
import { z } from "zod";
import { Public } from "../../common/auth.guard";
import { readInvite, readReceiptToken, signJwt } from "../../common/tokens";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { apiPublicUrl } from "../../config/env";
import { ApplicationsService } from "../applications/applications.service";
import { AuditService } from "../audit/audit.service";
import { PropertiesService } from "../properties/properties.service";
import { ReceiptsService } from "../receipts/receipts.service";
import { PrismaService } from "../../prisma/prisma.service";
import { StorageService } from "../../storage/storage.service";

const disputeSchema = z.object({ note: z.string().trim().min(3).max(500) });
const uploadPresignSchema = z.object({
  kind: z.enum(["ID", "PROOF_OF_INCOME"]),
  contentType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
});
const hits = new Map<string, number[]>();

@ApiTags("public")
@Public()
@Controller("public")
export class PublicController {
  constructor(
    private readonly properties: PropertiesService,
    private readonly applications: ApplicationsService,
    private readonly receipts: ReceiptsService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get("apply/:token")
  describe(@Param("token") token: string) {
    const invite = readInvite(token);
    return this.properties.publicUnit(invite.accountId, invite.unitId);
  }

  @Post("apply/:token")
  submit(
    @Param("token") token: string,
    @Ip() ip: string,
    @Body(new ZodValidationPipe(submitApplicationSchema.omit({ unitId: true })))
    body: Omit<ReturnType<typeof submitApplicationSchema.parse>, "unitId">,
  ) {
    limit(ip);
    const invite = readInvite(token);
    return this.applications.submitPublic(invite.accountId, { ...body, unitId: invite.unitId });
  }

  @Post("apply/:token/presign")
  presignApplyUpload(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(uploadPresignSchema)) body: z.infer<typeof uploadPresignSchema>,
  ) {
    const invite = readInvite(token);
    const key = `accounts/${invite.accountId}/uploads/${randomUUID()}`;
    if (this.storage.mode() === "s3") {
      return this.storage.presignPut(key, body.contentType).then((signed) => ({
        mode: "s3" as const,
        key,
        ...signed,
      }));
    }
    const uploadToken = signJwt({ key, contentType: body.contentType }, process.env.JWT_ACCESS_SECRET ?? "", 60 * 5);
    return {
      mode: "local" as const,
      key,
      uploadUrl: `${apiPublicUrl()}/api/uploads/local`,
      token: uploadToken,
    };
  }

  @Get("receipts/:token")
  async receipt(@Param("token") token: string) {
    const id = readReceiptToken(token);
    const db = await this.prisma.db();
    const receipt = await db.receipt.findUnique({
      where: { id },
      include: { payment: { include: { tenancy: { include: { tenant: true, unit: { include: { property: true } } } } } } },
    });
    if (!receipt) return { found: false };
    return {
      found: true,
      number: receipt.number,
      status: receipt.status,
      amountKobo: receipt.payment.amountKobo,
      tenant: receipt.payment.tenancy.tenant.fullName.split(" ")[0],
      unit: receipt.payment.tenancy.unit.label,
      property: receipt.payment.tenancy.unit.property.name,
    };
  }

  @Get("receipts/:token/file")
  @Header("Content-Type", "application/pdf")
  async file(@Param("token") token: string, @Res({ passthrough: true }) response: Response) {
    const file = await this.receipts.filePublic(readReceiptToken(token));
    response.setHeader("Content-Disposition", `inline; filename="${file.number}.pdf"`);
    return new StreamableFile(Buffer.from(file.bytes));
  }

  @Post("receipts/:token/confirm")
  async confirm(@Param("token") token: string) {
    const id = readReceiptToken(token);
    const db = await this.prisma.db();
    const receipt = await db.receipt.findUnique({ where: { id } });
    if (!receipt) return { confirmed: false };
    await this.audit.write(db, {
      accountId: receipt.accountId,
      action: "RECEIPT_CONFIRMED",
      entityType: "Receipt",
      entityId: receipt.id,
    });
    return { confirmed: true };
  }

  @Post("receipts/:token/dispute")
  async dispute(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(disputeSchema)) body: { note: string },
  ) {
    const id = readReceiptToken(token);
    const db = await this.prisma.db();
    const receipt = await db.receipt.findUnique({ where: { id } });
    if (!receipt) return { disputed: false };
    await this.audit.write(db, {
      accountId: receipt.accountId,
      action: "RECEIPT_DISPUTED",
      entityType: "Receipt",
      entityId: receipt.id,
      after: { note: body.note },
    });
    return { disputed: true };
  }
}

function limit(ip: string): void {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < 60 * 60 * 1000);
  if (recent.length >= 10) throw new HttpException("Too many applications from this network. Try again later.", 429);
  recent.push(now);
  hits.set(ip, recent);
}
