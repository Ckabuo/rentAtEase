import { Module } from "@nestjs/common";
import { ApplicationsModule } from "../applications/applications.module";
import { PropertiesModule } from "../properties/properties.module";
import { ReceiptsModule } from "../receipts/receipts.module";
import { PublicController } from "./public.controller";

@Module({
  imports: [PropertiesModule, ApplicationsModule, ReceiptsModule],
  controllers: [PublicController],
})
export class PublicModule {}
