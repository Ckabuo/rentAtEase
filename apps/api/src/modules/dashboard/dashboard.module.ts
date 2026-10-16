import { Module } from "@nestjs/common";
import { PlansModule } from "../plans/plans.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [PlansModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
