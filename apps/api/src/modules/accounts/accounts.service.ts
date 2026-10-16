import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { canAddCaretaker } from "@rae/domain";
import type { UpdateProfile, VerifySignInCode } from "@rae/schemas";
import { randomBytes } from "node:crypto";
import { phoneDigits, sha256 } from "../../common/crypto";
import type { AccountContext } from "../../common/account-context";
import { assertOwner } from "../../common/roles";
import { webOrigin, whatsAppConfigured, s3Configured, otpDelivery } from "../../config/env";
import { whatsAppTemplates } from "../../config/whatsapp-templates";
import { AuthService } from "../auth/auth.service";
import { AuditService } from "../audit/audit.service";
import { PlansService } from "../plans/plans.service";
import { MessagingService } from "../messaging/messaging.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../../prisma/types";

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
    private readonly messaging: MessagingService,
  ) {}

  async me(account: AccountContext) {
    const db = await this.prisma.db();
    const [user, membership, plan] = await Promise.all([
      db.user.findUnique({ where: { id: account.userId } }),
      db.account.findUnique({ where: { id: account.accountId } }),
      this.plans.limits(account.accountId),
    ]);
    const [units, caretakers, monthStart] = await Promise.all([
      db.unit.count({ where: { accountId: account.accountId, deletedAt: null } }),
      db.membership.count({ where: { accountId: account.accountId, role: "CARETAKER" } }),
      Promise.resolve(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    ]);
    const prequalifications = await db.application.count({
      where: { accountId: account.accountId, createdAt: { gte: monthStart } },
    });
    return {
      user: { id: user?.id, name: user?.name, phone: user?.phone, email: user?.email },
      account: { id: membership?.id, name: membership?.name, onboarding: membership?.onboarding ?? null },
      role: account.role,
      plan,
      usage: { units, caretakers, prequalifications },
      integrations: {
        whatsapp: whatsAppConfigured(),
        storage: s3Configured() ? "s3" : "local",
        otpDelivery: safeOtpDelivery(),
      },
    };
  }

  async updateProfile(account: AccountContext, input: UpdateProfile) {
    if (!input.name && !input.businessName) {
      throw new BadRequestException("Nothing to update.");
    }
    const db = await this.prisma.db();
    if (input.name) {
      await db.user.update({ where: { id: account.userId }, data: { name: input.name } });
    }
    if (input.businessName) {
      assertOwner(account);
      const membership = await db.account.findUnique({ where: { id: account.accountId } });
      const existing =
        membership?.onboarding && typeof membership.onboarding === "object" && !Array.isArray(membership.onboarding)
          ? (membership.onboarding as Record<string, unknown>)
          : {};
      await db.account.update({
        where: { id: account.accountId },
        data: { name: input.businessName, onboarding: { ...existing, businessName: input.businessName } },
      });
    }
    return this.me(account);
  }

  async linkContact(account: AccountContext, input: VerifySignInCode) {
    this.auth.assertSignInDestination({ channel: input.channel, destination: input.destination });
    const destination = await this.auth.consumeSignInCode(input);
    const db = await this.prisma.db();
    const conflict =
      input.channel === "EMAIL"
        ? await db.user.findFirst({ where: { email: destination, NOT: { id: account.userId } } })
        : await db.user.findFirst({ where: { phone: destination, NOT: { id: account.userId } } });
    if (conflict) {
      throw new BadRequestException(
        input.channel === "EMAIL"
          ? "That email is already linked to another account."
          : "That phone number is already linked to another account.",
      );
    }
    const current = await db.user.findUnique({ where: { id: account.userId } });
    if (!current) throw new BadRequestException("User not found.");
    if (input.channel === "EMAIL" && current.email === destination) return this.me(account);
    if (input.channel === "SMS" && current.phone === destination) return this.me(account);

    await db.user.update({
      where: { id: account.userId },
      data: input.channel === "EMAIL" ? { email: destination } : { phone: destination },
    });
    return this.me(account);
  }

  async invite(account: AccountContext, phone: string) {
    assertOwner(account);
    const plan = await this.plans.limits(account.accountId);
    const db = await this.prisma.db();
    const digits = phoneDigits(phone);
    const signInUrl = `${webOrigin()}/sign-in?invite=caretaker`;

    const existingUser = await db.user.findFirst({ where: { phone: digits } });
    if (existingUser) {
      return {
        url: signInUrl,
        whatsapp: { sent: false, reason: "Phone already registered" },
        message:
          "This phone number already has a Rent@Ease account. Caretaker invites are only for new numbers. Ask them to sign in, or use a different phone.",
      };
    }

    const caretakers = await db.membership.count({ where: { accountId: account.accountId, role: "CARETAKER" } });
    const pendingForPhone = await db.invitation.findFirst({
      where: {
        accountId: account.accountId,
        phone: digits,
        role: "CARETAKER",
        acceptedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!pendingForPhone && !canAddCaretaker(plan.code, caretakers)) {
      throw new BadRequestException(`${plan.name} does not include another caretaker.`);
    }

    const [owner, workspace] = await Promise.all([
      db.user.findUnique({ where: { id: account.userId } }),
      db.account.findUnique({ where: { id: account.accountId } }),
    ]);
    const inviterLabel =
      owner?.name && workspace?.name
        ? `${owner.name} (${workspace.name})`
        : owner?.name ?? workspace?.name ?? "Your landlord";

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = pendingForPhone
      ? await db.invitation.update({
          where: { id: pendingForPhone.id },
          data: {
            expiresAt,
            tokenHash: sha256(randomBytes(24).toString("base64url")),
          },
        })
      : await db.invitation.create({
          data: {
            accountId: account.accountId,
            phone: digits,
            role: "CARETAKER",
            tokenHash: sha256(randomBytes(24).toString("base64url")),
            expiresAt,
          },
        });

    const templateKey = whatsAppTemplates.caretakerInvite();
    const helloWorldTest = templateKey === "hello_world";
    const whatsapp = plan.whatsappEnabled
      ? await this.messaging.sendTemplate({
          accountId: account.accountId,
          to: digits,
          templateKey,
          body: helloWorldTest ? [] : [inviterLabel, signInUrl],
          languageCode: helloWorldTest ? "en_US" : undefined,
          dedupeKey: `caretaker-invite:${invitation.id}`,
        })
      : { status: "FAILED", reason: "WhatsApp invites need Standard or Pro.", messageId: "" };

    const renewed = Boolean(pendingForPhone);
    const message =
      whatsapp.status === "SENT"
        ? renewed
          ? "Invite renewed for 7 more days and WhatsApp was sent again."
          : "WhatsApp invite sent. They should sign in with this phone number within 7 days."
        : whatsapp.status === "SKIPPED"
          ? renewed
            ? "Invite renewed for 7 more days. WhatsApp was not sent again (already delivered recently)."
            : "An invite was already sent recently. They can sign in with this phone number within 7 days."
          : renewed
            ? `Invite renewed for 7 more days. ${whatsapp.reason ?? "WhatsApp could not be sent."} They can sign in at ${signInUrl} with this phone number.`
            : `Invite saved. ${whatsapp.reason ?? "WhatsApp could not be sent."} Ask them to sign in at ${signInUrl} with this phone number within 7 days.`;

    return { url: signInUrl, whatsapp: { sent: whatsapp.status === "SENT", reason: whatsapp.reason }, message };
  }

  async closeAccount(account: AccountContext) {
    assertOwner(account);
    const db = await this.prisma.db();
    const workspace = await db.account.findUnique({ where: { id: account.accountId } });
    if (!workspace) throw new NotFoundException("Account not found.");
    if (workspace.deletedAt) throw new BadRequestException("This account is already closed.");

    const now = new Date();
    await db.$transaction(async (tx) => {
      const client = tx as Db;
      await client.account.update({
        where: { id: account.accountId },
        data: { deletedAt: now },
      });
      await client.subscription.updateMany({
        where: { accountId: account.accountId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });
      await client.session.updateMany({
        where: {
          revokedAt: null,
          OR: [{ activeAccountId: account.accountId }, { id: account.sessionId }],
        },
        data: { revokedAt: now },
      });
      await this.audit.write(client, {
        accountId: account.accountId,
        actorUserId: account.userId,
        action: "ACCOUNT_CLOSED",
        entityType: "Account",
        entityId: account.accountId,
      });
    });

    return { message: "Your account has been closed." };
  }
}

function safeOtpDelivery(): string {
  try {
    return otpDelivery();
  } catch (error) {
    return error instanceof Error ? error.message : "unset";
  }
}
