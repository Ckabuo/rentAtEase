import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { createTenancySchema, createTenantSchema, moveOutSchema, updateTenantSchema } from "@rae/schemas";
import { CurrentAccount, type AccountContext } from "../../common/account-context";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { TenanciesService } from "./tenancies.service";

@ApiTags("tenancies")
@ApiBearerAuth()
@Controller("tenancies")
export class TenanciesController {
  constructor(private readonly tenancies: TenanciesService) {}

  @Get()
  list(@CurrentAccount() account: AccountContext) {
    return this.tenancies.list(account.accountId);
  }

  @Post("tenants")
  createTenant(
    @CurrentAccount() account: AccountContext,
    @Body(new ZodValidationPipe(createTenantSchema)) body: ReturnType<typeof createTenantSchema.parse>,
  ) {
    return this.tenancies.createTenant(account, body);
  }

  @Patch("tenants/:id")
  updateTenant(
    @CurrentAccount() account: AccountContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateTenantSchema)) body: ReturnType<typeof updateTenantSchema.parse>,
  ) {
    return this.tenancies.updateTenant(account, id, body);
  }

  @Delete("tenants/:id")
  deleteTenant(@CurrentAccount() account: AccountContext, @Param("id") id: string) {
    return this.tenancies.deleteTenant(account, id);
  }

  @Post()
  create(
    @CurrentAccount() account: AccountContext,
    @Body(new ZodValidationPipe(createTenancySchema)) body: ReturnType<typeof createTenancySchema.parse>,
  ) {
    return this.tenancies.createTenancy(account, body);
  }

  @Post(":id/move-out")
  moveOut(
    @CurrentAccount() account: AccountContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(moveOutSchema)) body: ReturnType<typeof moveOutSchema.parse>,
  ) {
    return this.tenancies.moveOut(account, id, body);
  }
}
