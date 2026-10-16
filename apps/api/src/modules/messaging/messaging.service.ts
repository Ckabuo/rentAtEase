import { Injectable, Logger } from "@nestjs/common";
import { phoneDigits } from "../../common/crypto";
import { whatsAppConfigured } from "../../config/env";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../../prisma/types";

export interface TemplateSend {
  accountId: string;
  to: string;
  templateKey: string;
  body: string[];
  /** Meta locale code; defaults to WHATSAPP_TEMPLATE_LANGUAGE or `en`. Use `en_US` for `hello_world`. */
  languageCode?: string;
  documentUrl?: string;
  documentName?: string;
  dedupeKey?: string;
}

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendTemplate(input: TemplateSend, db?: Db): Promise<{ status: string; reason?: string; messageId: string }> {
    const client = db ?? (await this.prisma.db());
    if (input.dedupeKey) {
      const existing = await client.message.findFirst({
        where: {
          accountId: input.accountId,
          status: { in: ["QUEUED", "SENT", "DELIVERED"] },
          payload: { path: ["dedupeKey"], equals: input.dedupeKey },
        },
      });
      if (existing) return { status: "SKIPPED", reason: "Already sent", messageId: existing.id };
    }

    const template = await client.messageTemplate.findUnique({ where: { key: input.templateKey } });
    const message = await client.message.create({
      data: {
        accountId: input.accountId,
        templateId: template?.id,
        channel: "WHATSAPP",
        toAddress: phoneDigits(input.to),
        status: "QUEUED",
        payload: {
          templateKey: input.templateKey,
          body: input.body,
          documentUrl: input.documentUrl,
          dedupeKey: input.dedupeKey,
        },
      },
    });

    if (!whatsAppConfigured()) {
      const reason = "WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not set. The message was saved and not sent.";
      await client.message.update({ where: { id: message.id }, data: { status: "FAILED", failureReason: reason } });
      return { status: "FAILED", reason, messageId: message.id };
    }

    try {
      const providerId = await this.postWhatsApp(message.toAddress, input);
      await client.message.update({
        where: { id: message.id },
        data: { status: "SENT", providerMessageId: providerId },
      });
      return { status: "SENT", messageId: message.id };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "WhatsApp send failed.";
      this.logger.warn(reason);
      await client.message.update({ where: { id: message.id }, data: { status: "FAILED", failureReason: reason } });
      return { status: "FAILED", reason, messageId: message.id };
    }
  }

  async list(accountId: string) {
    const db = await this.prisma.db();
    return db.message.findMany({ where: { accountId }, orderBy: { createdAt: "desc" }, take: 40 });
  }

  private async postWhatsApp(to: string, input: TemplateSend): Promise<string | undefined> {
    const version = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const components: unknown[] = [];
    if (input.documentUrl) {
      components.push({
        type: "header",
        parameters: [
          {
            type: "document",
            document: { link: input.documentUrl, filename: input.documentName ?? "receipt.pdf" },
          },
        ],
      });
    }
    if (input.body.length > 0) {
      components.push({
        type: "body",
        parameters: input.body.map((text) => ({ type: "text", text })),
      });
    }
    const language =
      input.languageCode?.trim() ||
      process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() ||
      "en";
    const template: { name: string; language: { code: string }; components?: unknown[] } = {
      name: input.templateKey,
      language: { code: language },
    };
    if (components.length > 0) template.components = components;
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template,
      }),
    });
    if (!response.ok) {
      throw new Error(
        `WhatsApp rejected ${input.templateKey} (HTTP ${response.status}). Confirm the template is approved and the recipient has opted in.`,
      );
    }
    const payload = (await response.json()) as { messages?: { id?: string }[] };
    return payload.messages?.[0]?.id;
  }
}
