import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AccountRole } from "@rae/domain";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import type { AccountContext } from "./account-context";
import { verifyJwt } from "./tokens";

export const IS_PUBLIC = "rae:public";
export const ALLOW_WITHOUT_ACCOUNT = "rae:no-account";
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const AllowWithoutAccount = () => SetMetadata(ALLOW_WITHOUT_ACCOUNT, true);

type AccessClaims = { sub?: string; sid?: string; aid?: string };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { account?: AccountContext; userId?: string; sessionId?: string }>();
    const token = readToken(request);
    if (!token) throw new UnauthorizedException("Sign in to continue.");

    let claims: AccessClaims;
    try {
      claims = verifyJwt<AccessClaims>(token, process.env.JWT_ACCESS_SECRET ?? "");
    } catch {
      throw new UnauthorizedException("Your session has expired. Sign in again.");
    }
    if (!claims.sub || !claims.sid) throw new UnauthorizedException("Your session has expired. Sign in again.");

    const db = await this.prisma.db();
    const session = await db.session.findFirst({
      where: { id: claims.sid, userId: claims.sub, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!session) throw new UnauthorizedException("Your session has expired. Sign in again.");

    request.userId = claims.sub;
    request.sessionId = claims.sid;
    const allowWithoutAccount = this.reflector.getAllAndOverride<boolean>(ALLOW_WITHOUT_ACCOUNT, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!claims.aid) {
      if (allowWithoutAccount) return true;
      throw new UnauthorizedException("Finish setup before using the portal.");
    }

    const membership = await db.membership.findUnique({
      where: { accountId_userId: { accountId: claims.aid, userId: claims.sub } },
      include: { account: { select: { deletedAt: true } } },
    });
    if (!membership) {
      if (allowWithoutAccount) return true;
      throw new UnauthorizedException("Finish setup before using the portal.");
    }
    if (membership.account.deletedAt) {
      throw new UnauthorizedException("This account has been closed.");
    }

    request.account = {
      accountId: membership.accountId,
      userId: membership.userId,
      role: membership.role as AccountRole,
      sessionId: session.id,
    };
    return true;
  }
}

export function readToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length).trim();
  const cookie = request.headers.cookie ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "rae_session") return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `rae_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 12}${secure}`;
}

export function clearSessionCookie(): string {
  return "rae_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0";
}
