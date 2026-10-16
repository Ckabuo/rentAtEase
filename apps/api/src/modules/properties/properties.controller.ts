import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { createPropertySchema, createUnitSchema, updatePropertySchema } from "@rae/schemas";
import { CurrentAccount, type AccountContext } from "../../common/account-context";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PropertiesService } from "./properties.service";

@ApiTags("properties")
@ApiBearerAuth()
@Controller("properties")
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  list(@CurrentAccount() account: AccountContext) {
    return this.properties.list(account.accountId);
  }

  @Post()
  create(
    @CurrentAccount() account: AccountContext,
    @Body(new ZodValidationPipe(createPropertySchema)) body: ReturnType<typeof createPropertySchema.parse>,
  ) {
    return this.properties.createProperty(account, body);
  }

  @Patch(":id")
  update(
    @CurrentAccount() account: AccountContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updatePropertySchema)) body: ReturnType<typeof updatePropertySchema.parse>,
  ) {
    return this.properties.updateProperty(account, id, body);
  }

  @Delete(":id")
  remove(@CurrentAccount() account: AccountContext, @Param("id") id: string) {
    return this.properties.deleteProperty(account, id);
  }

  @Post("units")
  createUnit(
    @CurrentAccount() account: AccountContext,
    @Body(new ZodValidationPipe(createUnitSchema)) body: ReturnType<typeof createUnitSchema.parse>,
  ) {
    return this.properties.createUnit(account, body);
  }

  @Post("units/:id/application-link")
  link(@CurrentAccount() account: AccountContext, @Param("id") id: string) {
    return this.properties.applicationLink(account, id);
  }
}
