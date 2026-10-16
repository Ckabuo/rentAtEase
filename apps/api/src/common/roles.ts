import { ForbiddenException } from "@nestjs/common";
import type { AccountContext } from "./account-context";

export function assertOwner(account: AccountContext): void {
  if (account.role !== "OWNER") {
    throw new ForbiddenException("Only the owner can do that.");
  }
}
