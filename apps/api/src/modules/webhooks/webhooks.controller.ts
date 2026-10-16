import { Controller, ForbiddenException, Get, Post, Req, Res, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { Public } from "../../common/auth.guard";
import { phoneDigits } from "../../common/crypto";
import { PrismaService } from "../../prisma/prisma.service";

type RawRequest = Request & { rawBody?: Buffer };

@ApiTags("webhooks")
@Public()
@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("whatsapp")
  verify(@Req() request: Request, @Res() response: Response) {
    const token = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
    if (!token) {
      throw new ServiceUnavailableException("WHATSAPP_VERIFY_TOKEN is not set.");
    }
    const mode = String(request.query["hub.mode"] ?? "");
    const verifyToken = String(request.query["hub.verify_token"] ?? "");
    const challenge = String(request.query["hub.challenge"] ?? "");
    if (mode === "subscribe" && verifyToken === token) {
      response.status(200).send(challenge);
      return;
    }
    throw new ForbiddenException("WhatsApp verify token did not match WHATSAPP_VERIFY_TOKEN.");
  }

  @Post("whatsapp")
  async receive(@Req() request: RawRequest) {
    const secret = process.env.WHATSAPP_APP_SECRET?.trim();
    if (!secret) throw new ServiceUnavailableException("WHATSAPP_APP_SECRET is not set.");
    const raw = request.rawBody;
    if (!raw) throw new UnauthorizedException("WhatsApp webhook body was not available to verify.");
    const header = String(request.header("x-hub-signature-256") ?? "");
    const provided = header.replace(/^sha256=/, "");
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    const left = Buffer.from(provided);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new UnauthorizedException("WhatsApp signature did not match. Check WHATSAPP_APP_SECRET.");
    }
    const body = request.body as {
      entry?: { changes?: { value?: { messages?: { from?: string; text?: { body?: string }; id?: string }[]; statuses?: { id?: string; status?: string }[] } }[] }[];
    };
    const db = await this.prisma.db();
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const status of change.value?.statuses ?? []) {
          if (!status.id) continue;
          const mapped = status.status === "delivered" || status.status === "read" ? "DELIVERED" : status.status === "failed" ? "FAILED" : "SENT";
          await db.message.updateMany({ where: { providerMessageId: status.id }, data: { status: mapped } });
        }
        for (const message of change.value?.messages ?? []) {
          if ((message.text?.body ?? "").trim().toLowerCase() !== "stop") continue;
          const from = phoneDigits(message.from ?? "");
          const tenants = await db.tenant.findMany({ where: { deletedAt: null } });
          for (const tenant of tenants) {
            if (phoneDigits(tenant.phone).endsWith(from.slice(-10))) {
              await db.tenant.update({
                where: { id: tenant.id },
                data: { whatsappConsent: false, whatsappOptedOutAt: new Date() },
              });
            }
          }
        }
      }
    }
    return { received: true };
  }
}
