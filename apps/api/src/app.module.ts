import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { AuthGuard } from "./common/auth.guard";
import { EnvModule } from "./config/env.module";
import { AccountsModule } from "./modules/accounts/accounts.module";
import { ApplicationsModule } from "./modules/applications/applications.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { HealthModule } from "./modules/health/health.module";
import { LedgerModule } from "./modules/ledger/ledger.module";
import { MessagingModule } from "./modules/messaging/messaging.module";
import { PlansModule } from "./modules/plans/plans.module";
import { PropertiesModule } from "./modules/properties/properties.module";
import { PublicModule } from "./modules/public/public.module";
import { ReceiptsModule } from "./modules/receipts/receipts.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { TenanciesModule } from "./modules/tenancies/tenancies.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { PrismaModule } from "./prisma/prisma.module";
import { StorageModule } from "./storage/storage.module";
import { WorkerModule } from "./worker/worker.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    EnvModule,
    PrismaModule,
    StorageModule,
    HealthModule,
    AuthModule,
    AccountsModule,
    PropertiesModule,
    TenanciesModule,
    ApplicationsModule,
    LedgerModule,
    ReceiptsModule,
    MessagingModule,
    PlansModule,
    AuditModule,
    WebhooksModule,
    UploadsModule,
    DashboardModule,
    ReportsModule,
    PublicModule,
    WorkerModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
