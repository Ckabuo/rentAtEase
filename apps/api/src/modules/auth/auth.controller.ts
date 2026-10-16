import { Body, Controller, Get, Headers, Ip, Post, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { requestSignInCodeSchema, signUpProfileSchema, verifySignInCodeSchema } from "@rae/schemas";
import type { Request, Response } from "express";
import { z } from "zod";
import { AllowWithoutAccount, Public, clearSessionCookie, sessionCookie } from "../../common/auth.guard";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { AuthService } from "./auth.service";

const onboardingBodySchema = z.object({
  profile: signUpProfileSchema,
  onboarding: z.unknown().optional(),
});

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("otp/request")
  request(
    @Body(new ZodValidationPipe(requestSignInCodeSchema)) body: ReturnType<typeof requestSignInCodeSchema.parse>,
    @Ip() ip: string,
  ) {
    return this.auth.requestCode(body, ip);
  }

  @Public()
  @Post("otp/verify")
  async verify(
    @Body(new ZodValidationPipe(verifySignInCodeSchema)) body: ReturnType<typeof verifySignInCodeSchema.parse>,
    @Headers("user-agent") userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.verify(body, userAgent);
    response.setHeader("Set-Cookie", sessionCookie(result.token));
    return result;
  }

  @AllowWithoutAccount()
  @Post("onboarding")
  async onboarding(
    @Req() request: Request & { userId?: string; sessionId?: string },
    @Body(new ZodValidationPipe(onboardingBodySchema)) body: z.infer<typeof onboardingBodySchema>,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!request.userId) return { needsOnboarding: true };
    const result = await this.auth.completeOnboarding(request.userId, request.sessionId, body.profile, body.onboarding ?? {});
    response.setHeader("Set-Cookie", sessionCookie(result.token));
    return result;
  }

  @AllowWithoutAccount()
  @Post("sign-out")
  async signOut(@Req() request: Request & { sessionId?: string }, @Res({ passthrough: true }) response: Response) {
    if (request.sessionId) await this.auth.signOut(request.sessionId);
    response.setHeader("Set-Cookie", clearSessionCookie());
    return { signedOut: true };
  }

  @AllowWithoutAccount()
  @Get("session")
  session(@Req() request: Request & { userId?: string; account?: { accountId: string } }) {
    return { userId: request.userId ?? null, accountId: request.account?.accountId ?? null };
  }
}
