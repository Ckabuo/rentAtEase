import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { TenanciesController } from "./tenancies.controller";
import { TenanciesService } from "./tenancies.service";

@Module({
  imports: [LedgerModule],
  controllers: [TenanciesController],
  providers: [TenanciesService],
  exports: [TenanciesService],
})
export class TenanciesModule {}
