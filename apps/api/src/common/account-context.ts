import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AccountRole } from "@rae/domain";

/** Populated from the session once sign-in exists. Every account-owned query uses this. */
export interface AccountContext {
  accountId: string;
  userId: string;
  role: AccountRole;
  sessionId: string;
}

export const CurrentAccount = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccountContext | undefined => {
    const request = ctx.switchToHttp().getRequest<{ account?: AccountContext }>();
    return request.account;
  },
);
