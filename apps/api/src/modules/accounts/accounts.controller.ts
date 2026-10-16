import { Body, Controller, Delete, Get, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { updateProfileSchema, phoneSchema, verifySignInCodeSchema } from "@rae/schemas";
import { z } from "zod";
import { CurrentAccount, type AccountContext } from "../../common/account-context";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { AccountsService } from "./accounts.service";

const inviteSchema = z.object({ phone: phoneSchema });

@ApiTags("accounts")
@ApiBearerAuth()
@Controller("accounts")
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get("me")
  me(@CurrentAccount() account: AccountContext) {
    return this.accounts.me(account);
  }

  @Patch("me")
  updateMe(
    @CurrentAccount() account: AccountContext,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: z.infer<typeof updateProfileSchema>,
  ) {
    return this.accounts.updateProfile(account, body);
  }

  @Post("me/contact")
  linkContact(
    @CurrentAccount() account: AccountContext,
    @Body(new ZodValidationPipe(verifySignInCodeSchema)) body: z.infer<typeof verifySignInCodeSchema>,
  ) {
    return this.accounts.linkContact(account, body);
  }

  @Post("invitations")
  invite(
    @CurrentAccount() account: AccountContext,
    @Body(new ZodValidationPipe(inviteSchema)) body: { phone: string },
  ) {
    return this.accounts.invite(account, body.phone);
  }

  @Delete("me")
  closeAccount(@CurrentAccount() account: AccountContext) {
    return this.accounts.closeAccount(account);
  }
}
