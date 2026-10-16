import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CurrentAccount, type AccountContext } from "../../common/account-context";
import { Public } from "../../common/auth.guard";
import { sha256Bytes } from "../../common/crypto";
import { apiPublicUrl } from "../../config/env";
import { signJwt, verifyJwt } from "../../common/tokens";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { StorageService } from "../../storage/storage.service";

const presignSchema = z.object({
  kind: z.enum(["ID", "PROOF_OF_INCOME"]),
  contentType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
});

const localSchema = z.object({
  token: z.string().min(10),
  contentBase64: z.string().min(1),
});

@ApiTags("uploads")
@Controller("uploads")
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @ApiBearerAuth()
  @Post("presign")
  async presign(
    @CurrentAccount() account: AccountContext,
    @Body(new ZodValidationPipe(presignSchema)) body: z.infer<typeof presignSchema>,
  ) {
    const key = `accounts/${account.accountId}/uploads/${randomUUID()}`;
    if (this.storage.mode() === "s3") {
      const signed = await this.storage.presignPut(key, body.contentType);
      return { mode: "s3" as const, key, ...signed };
    }
    const token = signJwt({ key, contentType: body.contentType }, process.env.JWT_ACCESS_SECRET ?? "", 60 * 5);
    return {
      mode: "local" as const,
      key,
      uploadUrl: `${apiPublicUrl()}/api/uploads/local`,
      token,
    };
  }

  @Public()
  @Post("local")
  async local(@Body(new ZodValidationPipe(localSchema)) body: z.infer<typeof localSchema>) {
    let claims: { key?: string; contentType?: string };
    try {
      claims = verifyJwt(body.token, process.env.JWT_ACCESS_SECRET ?? "");
    } catch {
      throw new BadRequestException("That upload link has expired. Request a new one.");
    }
    if (!claims.key || !claims.contentType) throw new BadRequestException("That upload link is not valid.");
    const bytes = Buffer.from(body.contentBase64, "base64");
    if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) {
      throw new BadRequestException("Files must be between 1 byte and 10 MB.");
    }
    await this.storage.put(claims.key, bytes, claims.contentType);
    return { key: claims.key, sizeBytes: bytes.length, sha256: sha256Bytes(bytes), contentType: claims.contentType };
  }
}
