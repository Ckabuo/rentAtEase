import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import nodemailer from "nodemailer";
import type { OtpDelivery } from "../../config/env";
import { whatsAppTemplates } from "../../config/whatsapp-templates";
import { phoneDigits } from "../../common/crypto";

type LiveDelivery = Exclude<OtpDelivery, "log">;

@Injectable()
export class OtpSender {
  async send(delivery: LiveDelivery, destination: string, code: string, channel: "SMS" | "EMAIL"): Promise<void> {
    if (channel === "EMAIL") {
      await this.sendEmail(destination, code);
      return;
    }
    if (delivery === "termii") {
      await this.sendTermii(destination, code);
      return;
    }
    if (delivery === "infobip") {
      await this.sendInfobip(destination, code);
      return;
    }
    await this.sendWhatsApp(destination, code);
  }

  private async sendTermii(destination: string, code: string): Promise<void> {
    const apiKey = process.env.TERMII_API_KEY?.trim();
    const sender = process.env.TERMII_SENDER_ID?.trim();
    if (!apiKey || !sender) {
      throw new ServiceUnavailableException("TERMII_API_KEY and TERMII_SENDER_ID are required when OTP_DELIVERY=termii.");
    }
    const base = (process.env.TERMII_BASE_URL ?? "https://api.ng.termii.com").replace(/\/$/, "");
    const response = await fetch(`${base}/api/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        to: phoneDigits(destination),
        from: sender,
        sms: `Your Rent@Ease sign-in code is ${code}. It expires in 5 minutes.`,
        type: "plain",
        channel: "dnd",
      }),
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Termii rejected the SMS (HTTP ${response.status}). Check TERMII_API_KEY and TERMII_SENDER_ID.`,
      );
    }
  }

  private async sendInfobip(destination: string, code: string): Promise<void> {
    const apiKey = process.env.INFOBIP_API_KEY?.trim();
    const sender = process.env.INFOBIP_SENDER?.trim();
    const base = infobipBaseUrl();
    if (!apiKey || !sender || !base) {
      throw new ServiceUnavailableException(
        "INFOBIP_BASE_URL, INFOBIP_API_KEY, and INFOBIP_SENDER are required when OTP_DELIVERY=infobip.",
      );
    }
    const response = await fetch(`${base}/sms/2/text/advanced`, {
      method: "POST",
      headers: {
        Authorization: `App ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            from: sender,
            destinations: [{ to: phoneDigits(destination) }],
            text: `Your Rent@Ease sign-in code is ${code}. It expires in 5 minutes.`,
          },
        ],
      }),
    });
    const payload = (await response.json().catch(() => null)) as InfobipSmsResponse | null;
    const status = payload?.messages?.[0]?.status;
    const rejected = status?.groupName === "REJECTED" || status?.groupName === "UNDELIVERABLE";
    if (!response.ok || rejected) {
      const detail = status?.description || payload?.requestError?.serviceException?.text;
      throw new ServiceUnavailableException(
        detail
          ? `Infobip rejected the SMS (HTTP ${response.status}): ${detail}`
          : `Infobip rejected the SMS (HTTP ${response.status}). Check INFOBIP_BASE_URL, INFOBIP_API_KEY, and INFOBIP_SENDER.`,
      );
    }
  }

  private async sendWhatsApp(destination: string, code: string): Promise<void> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    if (!token || !phoneNumberId) {
      throw new ServiceUnavailableException(
        "WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required when OTP_DELIVERY=whatsapp.",
      );
    }
    const version = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
    const template = whatsAppTemplates.otp();
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phoneDigits(destination),
        type: "template",
        template: {
          name: template,
          language: { code: "en" },
          components: [{ type: "body", parameters: [{ type: "text", text: code }] }],
        },
      }),
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `WhatsApp rejected the sign-in code (HTTP ${response.status}). Check the token, phone number id, and that ${template} is an approved template.`,
      );
    }
  }

  private async sendEmail(destination: string, code: string): Promise<void> {
    const brevoKey = process.env.BREVO_API_KEY?.trim();
    if (brevoKey) {
      await this.sendBrevo(brevoKey, destination, code);
      return;
    }

    const host = process.env.SMTP_HOST?.trim();
    const from = process.env.SMTP_FROM?.trim();
    const port = Number(process.env.SMTP_PORT ?? "587");
    if (!host || !from || !Number.isFinite(port)) {
      throw new ServiceUnavailableException(
        "Email codes need BREVO_API_KEY and SMTP_FROM, or SMTP_HOST, SMTP_PORT and SMTP_FROM. Sign in with a phone number, or set OTP_DELIVERY=log for a local test.",
      );
    }
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
        : undefined,
    });
    await transport.sendMail({
      from,
      to: destination,
      subject: "Your Rent@Ease sign-in code",
      text: `Your Rent@Ease sign-in code is ${code}. It expires in 5 minutes.`,
    });
  }

  private async sendBrevo(apiKey: string, destination: string, code: string): Promise<void> {
    const sender = emailSenderFromEnv();
    const text = `Your Rent@Ease sign-in code is ${code}. It expires in 5 minutes.`;
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: destination }],
        subject: "Your Rent@Ease sign-in code",
        textContent: text,
        htmlContent: `<p>${text}</p>`,
      }),
    });
    const payload = (await response.json().catch(() => null)) as BrevoSendResponse | null;
    if (!response.ok) {
      const detail = payload?.message ?? payload?.code;
      throw new ServiceUnavailableException(
        detail
          ? `Brevo rejected the email (HTTP ${response.status}): ${detail}`
          : `Brevo rejected the email (HTTP ${response.status}). Check BREVO_API_KEY and that the sender is verified in Brevo.`,
      );
    }
  }
}

function emailSenderFromEnv(): { email: string; name?: string } {
  const raw =
    process.env.BREVO_SENDER_EMAIL?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    "";
  const parsed = parseSenderAddress(raw);
  if (!parsed.email) {
    throw new ServiceUnavailableException(
      "Set SMTP_FROM or BREVO_SENDER_EMAIL to a verified sender address in Brevo.",
    );
  }
  const name = process.env.BREVO_SENDER_NAME?.trim() || parsed.name || "Rent@Ease";
  return { email: parsed.email, name };
}

/** Supports `you@domain.com` or `Rent@Ease <you@domain.com>`. */
function parseSenderAddress(raw: string): { email: string; name?: string } {
  const angle = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (angle) {
    return { name: angle[1]!.trim().replace(/^["']|["']$/g, ""), email: angle[2]!.trim() };
  }
  return { email: raw.trim() };
}

type BrevoSendResponse = {
  message?: string;
  code?: string;
  messageId?: string;
};

type InfobipSmsResponse = {
  messages?: Array<{ status?: { groupName?: string; description?: string } }>;
  requestError?: { serviceException?: { text?: string } };
};

/** Accepts a host (`xxxx.api.infobip.com`) or a full https URL. */
function infobipBaseUrl(): string {
  const raw = process.env.INFOBIP_BASE_URL?.trim().replace(/\/$/, "") ?? "";
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}
