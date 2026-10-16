import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { nextResendAt, OTP_CODE_TTL_SECONDS, OTP_SEND_WINDOW_MS } from "@rae/domain";
import type { RequestSignInCode, SignUpProfile, VerifySignInCode } from "@rae/schemas";
import { isProduction, otpDelivery } from "../../config/env";
import { hashOtp, hashesMatch, maskDestination, phoneDigits, randomDigits, sha256 } from "../../common/crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { ACCESS_TTL_SECONDS, signJwt } from "../../common/tokens";
import { OtpSender } from "./otp-sender";

const OTP_TTL_MS = OTP_CODE_TTL_SECONDS * 1000;
const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

export type OtpRequestResult = {
  delivery: string;
  devCode?: string;
  resendAvailableAt: string;
  codeExpiresAt: string;
  codeExpiresInSeconds: number;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly ipHits = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: OtpSender,
  ) {}

  async requestCode(input: RequestSignInCode, ip: string): Promise<OtpRequestResult> {
    this.assertDestination(input);
    this.rateLimitIp(ip);
    const destination = this.normalize(input);
    const db = await this.prisma.db();
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await db.signInCode.count({ where: { destination, createdAt: { gte: since } } });
    if (recent >= MAX_CODES_PER_HOUR) {
      throw new HttpException("Too many codes for this phone or email. Try again in an hour.", 429);
    }

    const windowStart = new Date(Date.now() - OTP_SEND_WINDOW_MS);
    const sendsInWindow = await db.signInCode.findMany({
      where: { destination, channel: input.channel, createdAt: { gte: windowStart } },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true },
    });
    const sendsCount = sendsInWindow.length;
    if (sendsCount > 0) {
      const lastSent = sendsInWindow[sendsCount - 1]!.createdAt;
      const availableAt = nextResendAt(lastSent, sendsCount, input.channel);
      if (Date.now() < availableAt.getTime()) {
        const retryAfterSeconds = Math.ceil((availableAt.getTime() - Date.now()) / 1000);
        throw new HttpException(
          {
            statusCode: 429,
            message: `Resend available in ${retryAfterSeconds}s.`,
            retryAfterSeconds,
            resendAvailableAt: availableAt.toISOString(),
          },
          429,
        );
      }
      await db.signInCode.updateMany({
        where: { destination, channel: input.channel, consumedAt: null },
        data: { consumedAt: new Date() },
      });
    }

    const code = randomDigits(6);
    const delivery = otpDelivery();
    const codeExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    await db.signInCode.create({
      data: {
        channel: input.channel,
        destination,
        codeHash: hashOtp(code),
        expiresAt: codeExpiresAt,
      },
    });

    const newSendsCount = sendsCount + 1;
    const resendAvailableAt = nextResendAt(new Date(), newSendsCount, input.channel);
    const base: OtpRequestResult = {
      delivery,
      resendAvailableAt: resendAvailableAt.toISOString(),
      codeExpiresAt: codeExpiresAt.toISOString(),
      codeExpiresInSeconds: OTP_CODE_TTL_SECONDS,
    };

    if (delivery === "log") {
      this.logger.log(`Sign-in code for ${maskDestination(destination)} is ${code}`);
      return { ...base, ...(isProduction() ? {} : { devCode: code }) };
    }

    try {
      await this.sender.send(delivery, destination, code, input.channel);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The code could not be sent.";
      throw new ServiceUnavailableException(message);
    }
    return base;
  }

  async consumeSignInCode(input: VerifySignInCode): Promise<string> {
    const destination = this.normalize(input);
    const db = await this.prisma.db();
    const pending = await db.signInCode.findFirst({
      where: { destination, channel: input.channel, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!pending) throw new UnauthorizedException("That code is expired or incorrect.");
    if (pending.attemptCount >= MAX_ATTEMPTS) {
      throw new UnauthorizedException("Too many attempts. Request a new code.");
    }
    if (!hashesMatch(pending.codeHash, hashOtp(input.code))) {
      await db.signInCode.update({ where: { id: pending.id }, data: { attemptCount: { increment: 1 } } });
      throw new UnauthorizedException("That code is expired or incorrect.");
    }
    await db.signInCode.update({ where: { id: pending.id }, data: { consumedAt: new Date() } });
    return destination;
  }

  normalizeDestination(input: { channel: "SMS" | "EMAIL"; destination: string }): string {
    return this.normalize(input);
  }

  assertSignInDestination(input: RequestSignInCode): void {
    this.assertDestination(input);
  }

  async verify(input: VerifySignInCode, userAgent?: string) {
    const destination = await this.consumeSignInCode(input);
    const db = await this.prisma.db();
    const user = await this.upsertUser(destination, input.channel);
    const invitation = await db.invitation.findFirst({
      where: {
        acceptedAt: null,
        expiresAt: { gt: new Date() },
        OR: [{ phone: destination }, { email: destination }],
      },
      orderBy: { createdAt: "desc" },
    });

    let accountId: string | null = null;
    let role: "OWNER" | "CARETAKER" | null = null;
    if (invitation) {
      await db.membership.upsert({
        where: { accountId_userId: { accountId: invitation.accountId, userId: user.id } },
        update: { role: invitation.role },
        create: { accountId: invitation.accountId, userId: user.id, role: invitation.role },
      });
      await db.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
      accountId = invitation.accountId;
      role = invitation.role;
    } else {
      const membership = await db.membership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
      accountId = membership?.accountId ?? null;
      role = membership?.role ?? null;
    }

    const session = await db.session.create({
      data: {
        userId: user.id,
        activeAccountId: accountId,
        refreshTokenHash: sha256(randomDigits(18)),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userAgent: userAgent?.slice(0, 240),
      },
    });
    const token = this.accessToken(user.id, session.id, accountId, role);
    return {
      token,
      needsOnboarding: accountId === null,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email },
    };
  }

  async completeOnboarding(userId: string, sessionId: string | undefined, profile: SignUpProfile, onboarding: unknown) {
    const db = await this.prisma.db();
    const user = await db.user.update({
      where: { id: userId },
      data: {
        name: profile.name,
        phone: profile.phone ? phoneDigits(profile.phone) : undefined,
        email: profile.email?.trim().toLowerCase(),
      },
    });
    let membership = await db.membership.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
    if (!membership) {
      const account = await db.account.create({
        data: { name: profile.businessName, onboarding: onboarding as object },
      });
      membership = await db.membership.create({
        data: { accountId: account.id, userId, role: "OWNER" },
      });
      await db.subscription.create({
        data: { accountId: account.id, planCode: "STARTER", activatedByUserId: userId },
      });
    } else {
      await db.account.update({
        where: { id: membership.accountId },
        data: { name: profile.businessName, onboarding: onboarding as object },
      });
    }

    const session =
      (sessionId
        ? await db.session.findFirst({ where: { id: sessionId, userId, revokedAt: null } })
        : await db.session.findFirst({ where: { userId, revokedAt: null }, orderBy: { createdAt: "desc" } })) ?? null;
    if (session) {
      await db.session.update({ where: { id: session.id }, data: { activeAccountId: membership.accountId } });
    }
    const activeSession = session ?? (await db.session.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }));
    if (!activeSession) throw new UnauthorizedException("Sign in again to finish setup.");
    return {
      token: this.accessToken(user.id, activeSession.id, membership.accountId, membership.role),
      accountId: membership.accountId,
      user: { id: user.id, name: user.name },
    };
  }

  async signOut(sessionId: string): Promise<void> {
    const db = await this.prisma.db();
    await db.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  }

  private accessToken(userId: string, sessionId: string, accountId: string | null, role: string | null): string {
    return signJwt(
      { sub: userId, sid: sessionId, ...(accountId ? { aid: accountId, role } : {}) },
      process.env.JWT_ACCESS_SECRET ?? "",
      ACCESS_TTL_SECONDS,
    );
  }

  private async upsertUser(destination: string, channel: "SMS" | "EMAIL") {
    const db = await this.prisma.db();
    if (channel === "EMAIL") {
      return db.user.upsert({
        where: { email: destination },
        update: {},
        create: { email: destination, name: destination },
      });
    }
    return db.user.upsert({
      where: { phone: destination },
      update: {},
      create: { phone: destination, name: destination },
    });
  }

  private normalize(input: { channel: "SMS" | "EMAIL"; destination: string }): string {
    return input.channel === "EMAIL" ? input.destination.trim().toLowerCase() : phoneDigits(input.destination);
  }

  private assertDestination(input: RequestSignInCode): void {
    if (input.channel === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.destination)) {
      throw new BadRequestException("Enter a valid email address.");
    }
    if (input.channel === "SMS") {
      const local = input.destination.replace(/\D/g, "");
      if (local.length !== 11 || !/^0[789]\d{9}$/.test(local)) {
        throw new BadRequestException("Enter an 11-digit Nigerian phone number (e.g. 08030000000).");
      }
    }
  }

  private rateLimitIp(ip: string): void {
    const now = Date.now();
    const hits = (this.ipHits.get(ip) ?? []).filter((at) => now - at < 60 * 60 * 1000);
    if (hits.length >= 20) throw new HttpException("Too many sign-in attempts from this network. Try again later.", 429);
    hits.push(now);
    this.ipHits.set(ip, hits);
  }
}
