import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PLANS } from "@rae/domain";
import { createPrismaClient } from "../src/prisma/client";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(apiRoot, "../..");

config({ path: path.join(repoRoot, ".env") });
config({ path: path.join(apiRoot, ".env") });

const localDatabaseUrl = "postgresql://postgres:postgres@localhost:5432/rent_at_ease";
const databaseUrl = process.env.DATABASE_URL ?? localDatabaseUrl;

const prisma = createPrismaClient(databaseUrl);

const TEMPLATES = [
  ["rae_rent_reminder", "rae_rent_reminder"],
  ["rae_rent_overdue", "rae_rent_overdue"],
  ["rae_rent_receipt", "rae_rent_receipt"],
  ["rae_tenant_welcome", "rae_tenant_welcome"],
  ["rae_application_received", "rae_application_received"],
  ["rae_application_decision", "rae_application_decision"],
  ["rae_owner_overdue", "rae_owner_overdue"],
  ["rae_otp", "rae_otp"],
  ["rae_caretaker_invite", "rae_caretaker_invite"],
] as const;

async function main(): Promise<void> {
  for (const plan of Object.values(PLANS)) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        monthlyPriceKobo: plan.monthlyPriceKobo,
        unitLimit: plan.unitLimit,
        prequalificationsPerMonth: plan.prequalificationsPerMonth,
        caretakerLimit: plan.caretakerLimit,
        whatsappEnabled: plan.whatsappEnabled,
        reportsTier: plan.reports,
      },
      create: {
        code: plan.code,
        name: plan.name,
        monthlyPriceKobo: plan.monthlyPriceKobo,
        unitLimit: plan.unitLimit,
        prequalificationsPerMonth: plan.prequalificationsPerMonth,
        caretakerLimit: plan.caretakerLimit,
        whatsappEnabled: plan.whatsappEnabled,
        reportsTier: plan.reports,
      },
    });
  }

  for (const [key, externalName] of TEMPLATES) {
    await prisma.messageTemplate.upsert({
      where: { key },
      update: { externalName },
      create: { key, externalName, channel: "WHATSAPP", category: "UTILITY" },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
