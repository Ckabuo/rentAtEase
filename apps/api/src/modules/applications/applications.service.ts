import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { canRunPrequalification, scoreApplication } from "@rae/domain";
import type { ApplicationDecisionInput, SubmitApplication } from "@rae/schemas";
import type { AccountContext } from "../../common/account-context";
import { decryptField, encryptField, idNumberLooksValid } from "../../common/crypto";
import { lagosYearMonth } from "../../common/dates";
import { assertOwner } from "../../common/roles";
import { whatsAppTemplates } from "../../config/whatsapp-templates";
import { AuditService } from "../audit/audit.service";
import { MessagingService } from "../messaging/messaging.service";
import { PlansService } from "../plans/plans.service";
import { TenanciesService } from "../tenancies/tenancies.service";
import { PrismaService } from "../../prisma/prisma.service";
import { StorageService } from "../../storage/storage.service";
import type { Db } from "../../prisma/types";

const NOTICE_VERSION = "2026-10";

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly tenancies: TenanciesService,
    private readonly messaging: MessagingService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async list(accountId: string) {
    const db = await this.prisma.db();
    const rows = await db.application.findMany({
      where: { accountId },
      include: { applicant: true, unit: { include: { property: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.present(row));
  }

  async submitPublic(accountId: string, input: SubmitApplication) {
    return this.create(accountId, input, null);
  }

  async get(account: AccountContext, id: string) {
    const db = await this.prisma.db();
    const row = await db.application.findFirst({
      where: { id, accountId: account.accountId },
      include: { applicant: true, unit: { include: { property: true, rentRates: { orderBy: { effectiveFrom: "desc" }, take: 1 } } }, documents: true },
    });
    if (!row) throw new NotFoundException("Application not found.");
    return {
      ...this.present(row),
      declared: {
        employmentStatus: row.employmentStatus,
        yearsInCurrentJob: row.yearsInCurrentJob,
        monthlyIncomeKobo: row.monthlyIncomeKobo,
        incomeSource: row.incomeSource,
        guarantorName: row.guarantorName,
        guarantorWillSign: row.guarantorWillSign,
        reference: row.reference,
        idType: row.idType,
        idNumber: row.idNumberCiphertext ? maskId(row.idNumberCiphertext) : null,
      },
      documents: row.documents.map((document) => ({ id: document.id, kind: document.kind, contentType: document.contentType })),
      rentAmountKobo: row.unit.rentRates[0]?.amountKobo ?? 0,
    };
  }

  async revealId(account: AccountContext, id: string) {
    assertOwner(account);
    const db = await this.prisma.db();
    const row = await db.application.findFirst({ where: { id, accountId: account.accountId } });
    if (!row?.idNumberCiphertext) throw new NotFoundException("No ID number is stored on this application.");
    const idNumber = decryptField(row.idNumberCiphertext);
    await this.audit.write(db, {
      accountId: account.accountId,
      actorUserId: account.userId,
      action: "ID_REVEALED",
      entityType: "Application",
      entityId: id,
    });
    return { idNumber };
  }

  /** Dev / Postman helper. Prefer an authenticated route before production. */
  async resendReceivedNotificationPublic(id: string) {
    const db = await this.prisma.db();
    const row = await db.application.findFirst({
      where: { id },
      include: { applicant: true, unit: { include: { property: true } } },
    });
    if (!row) throw new NotFoundException("Application not found.");
    const plan = await this.plans.limits(row.accountId);
    if (!plan.whatsappEnabled) {
      return { sent: false, reason: "WhatsApp notifications are not enabled on this plan." };
    }
    const result = await this.messaging.sendTemplate({
      accountId: row.accountId,
      to: row.applicant.phone,
      templateKey: whatsAppTemplates.applicationReceived(),
      body: [row.applicant.fullName, `${row.unit.property.name} ${row.unit.label}`],
      dedupeKey: `application:${row.id}:resend:${Date.now()}`,
    });
    await this.audit.write(db, {
      accountId: row.accountId,
      actorUserId: null,
      action: "APPLICATION_NOTIFICATION_RESENT",
      entityType: "Application",
      entityId: id,
      after: { status: result.status, messageId: result.messageId, public: true },
    });
    return {
      sent: result.status === "SENT",
      status: result.status,
      reason: result.reason,
      messageId: result.messageId,
    };
  }

  async decide(account: AccountContext, id: string, input: ApplicationDecisionInput) {
    assertOwner(account);
    const db = await this.prisma.db();
    const row = await db.application.findFirst({
      where: { id, accountId: account.accountId },
      include: { applicant: true, unit: { include: { property: true, rentRates: { orderBy: { effectiveFrom: "desc" }, take: 1 } } } },
    });
    if (!row) throw new NotFoundException("Application not found.");
    if (row.status === "APPROVED" || row.status === "DECLINED") {
      throw new BadRequestException("This application already has a decision.");
    }
    if (input.decision === "APPROVE") {
      if (!input.leaseStartDate) throw new BadRequestException("Choose the lease start date to approve.");
      if (row.unit.status !== "VACANT") throw new BadRequestException("That unit is no longer vacant.");
      const rent = row.unit.rentRates[0];
      const tenant = await this.tenancies.createTenant(account, {
        fullName: row.applicant.fullName,
        phone: row.applicant.phone,
        email: row.applicant.email ?? undefined,
        whatsappConsent: input.whatsappConsent ?? false,
      });
      const tenancy = await this.tenancies.createTenancy(account, {
        tenantId: tenant.id,
        unitId: row.unitId,
        startDate: input.leaseStartDate,
        cycle: rent?.cycle ?? row.rentCycle,
        rentAmountKobo: rent?.amountKobo ?? row.affordableRentKobo,
        openingArrearsKobo: 0,
      });
      await db.application.update({
        where: { id },
        data: {
          status: "APPROVED",
          decision: "APPROVE",
          decisionNote: input.note,
          decidedAt: new Date(),
          tenantId: tenant.id,
          tenancyId: tenancy.id,
        },
      });
      await this.audit.write(db, {
        accountId: account.accountId,
        actorUserId: account.userId,
        action: "APPLICATION_APPROVED",
        entityType: "Application",
        entityId: id,
        after: { tenancyId: tenancy.id },
      });
      await this.notifyDecision(account.accountId, row.applicant.phone, row.applicant.fullName, "approved");
      return { status: "APPROVED", tenancyId: tenancy.id };
    }

    const declined = input.decision === "DECLINE";
    await db.application.update({
      where: { id },
      data: {
        status: declined ? "DECLINED" : "INFO_REQUESTED",
        decision: input.decision,
        decisionNote: input.note,
        decidedAt: new Date(),
        purgeAfter: declined ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) : null,
      },
    });
    await this.audit.write(db, {
      accountId: account.accountId,
      actorUserId: account.userId,
      action: declined ? "APPLICATION_DECLINED" : "APPLICATION_INFO_REQUESTED",
      entityType: "Application",
      entityId: id,
      after: { note: input.note ?? null },
    });
    await this.notifyDecision(
      account.accountId,
      row.applicant.phone,
      row.applicant.fullName,
      declined ? "declined" : "more information was requested",
    );
    return { status: declined ? "DECLINED" : "INFO_REQUESTED" };
  }

  async purgeExpired(): Promise<number> {
    const db = await this.prisma.db();
    const due = await db.application.findMany({
      where: { purgeAfter: { lte: new Date() }, documents: { some: {} } },
      include: { documents: true },
    });
    for (const application of due) {
      for (const document of application.documents) {
        await db.document.delete({ where: { id: document.id } });
      }
      await this.audit.write(db, {
        accountId: application.accountId,
        action: "APPLICATION_DOCUMENTS_PURGED",
        entityType: "Application",
        entityId: application.id,
      });
    }
    return due.length;
  }

  private async create(accountId: string, input: SubmitApplication, actorUserId: string | null) {
    const db = await this.prisma.db();
    const unit = await db.unit.findFirst({
      where: { id: input.unitId, accountId, deletedAt: null },
      include: { property: true, rentRates: { orderBy: { effectiveFrom: "desc" }, take: 1 } },
    });
    if (!unit) throw new NotFoundException("Unit not found.");
    if (unit.status !== "VACANT") throw new BadRequestException("That unit is not vacant.");
    await this.assertPrequalLimit(db, accountId);
    const rentAmountKobo = unit.rentRates[0]?.amountKobo ?? input.affordableRentKobo;
    const score = scoreApplication(this.declared(input, rentAmountKobo));
    const encrypted = input.idNumber ? encryptField(input.idNumber) : null;
    let possibleDuplicate = false;
    if (encrypted) {
      const prior = await db.application.findFirst({
        where: { accountId, idNumberBlindIndex: encrypted.blindIndex },
      });
      possibleDuplicate = Boolean(prior);
    }
    for (const document of input.documents ?? []) {
      const stored = await this.storage.exists(document.storageKey);
      if (!stored || !document.storageKey.startsWith(`accounts/${accountId}/`)) {
        throw new BadRequestException("Upload the ID and proof of income again before submitting.");
      }
    }
    const applicant = await db.applicant.create({
      data: { accountId, fullName: input.fullName, phone: input.phone, email: input.email },
    });
    const application = await db.application.create({
      data: {
        accountId,
        applicantId: applicant.id,
        unitId: unit.id,
        employmentStatus: input.employmentStatus,
        yearsInCurrentJob: input.yearsInCurrentJob,
        monthlyIncomeKobo: input.monthlyIncomeKobo,
        incomeSource: input.incomeSource,
        affordableRentKobo: input.affordableRentKobo,
        rentCycle: input.rentCycle,
        guarantorName: input.guarantorName,
        guarantorPhone: input.guarantorPhone,
        guarantorWillSign: input.guarantorWillSign,
        guarantorEmployment: input.guarantorEmployment,
        nextOfKinName: input.nextOfKinName,
        nextOfKinPhone: input.nextOfKinPhone,
        idType: input.idType,
        idNumberCiphertext: encrypted?.ciphertext,
        idNumberBlindIndex: encrypted?.blindIndex,
        reference: input.reference,
        score: score.score,
        scoreBreakdown: score.breakdown,
        rubricVersion: score.rubricVersion,
        recommendation: score.recommendation,
      },
    });
    await db.consentRecord.create({
      data: {
        accountId,
        applicationId: application.id,
        subject: "APPLICANT",
        noticeVersion: input.consent.noticeVersion || NOTICE_VERSION,
      },
    });
    for (const document of input.documents ?? []) {
      await db.document.create({
        data: {
          accountId,
          applicationId: application.id,
          kind: document.kind,
          storageKey: document.storageKey,
          contentType: document.contentType,
          sizeBytes: document.sizeBytes,
          sha256: document.sha256,
        },
      });
    }
    await this.audit.write(db, {
      accountId,
      actorUserId,
      action: "APPLICATION_SUBMITTED",
      entityType: "Application",
      entityId: application.id,
      after: { score: score.score, recommendation: score.recommendation, possibleDuplicate },
    });
    const plan = await this.plans.limits(accountId);
    if (plan.whatsappEnabled) {
      await this.messaging.sendTemplate({
        accountId,
        to: input.phone,
        templateKey: whatsAppTemplates.applicationReceived(),
        body: [input.fullName, `${unit.property.name} ${unit.label}`],
        dedupeKey: `application:${application.id}`,
      });
    }
    return { id: application.id, ...score, possibleDuplicate };
  }

  private async assertPrequalLimit(db: Db, accountId: string) {
    const plan = await this.plans.limits(accountId);
    const { year, month } = lagosYearMonth();
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const completed = await db.application.count({
      where: { accountId, createdAt: { gte: start, lt: end } },
    });
    if (!canRunPrequalification(plan.code, completed)) {
      throw new BadRequestException(
        `${plan.name} includes ${plan.prequalificationsPerMonth} completed pre-qualification per calendar month.`,
      );
    }
  }

  private declared(input: SubmitApplication, rentAmountKobo: number) {
    const documents = input.documents ?? [];
    return {
      employmentStatus: input.employmentStatus,
      yearsInCurrentJob: input.yearsInCurrentJob,
      monthlyIncomeKobo: input.monthlyIncomeKobo,
      incomeSource: input.incomeSource,
      rentAmountKobo,
      rentCycle: input.rentCycle,
      guarantorAvailable: Boolean(input.guarantorName),
      guarantorWillSign: input.guarantorWillSign,
      guarantorEmployment: input.guarantorEmployment ?? null,
      idDocumentProvided: documents.some((document) => document.kind === "ID"),
      proofOfIncomeProvided: documents.some((document) => document.kind === "PROOF_OF_INCOME"),
      idNumberFormatValid: idNumberLooksValid(input.idType, input.idNumber),
      reference: input.reference,
    };
  }

  private present(row: {
    id: string;
    status: string;
    score: number | null;
    recommendation: string | null;
    scoreBreakdown: unknown;
    createdAt: Date;
    decisionNote: string | null;
    applicant: { fullName: string; phone: string };
    unit: { label: string; property: { name: string } };
  }) {
    return {
      id: row.id,
      status: row.status,
      score: row.score,
      recommendation: row.recommendation,
      breakdown: row.scoreBreakdown,
      note: row.decisionNote,
      createdAt: row.createdAt.toISOString(),
      applicant: row.applicant.fullName,
      phone: row.applicant.phone,
      unit: row.unit.label,
      property: row.unit.property.name,
    };
  }

  private async notifyDecision(accountId: string, phone: string, name: string, outcome: string) {
    const plan = await this.plans.limits(accountId);
    if (!plan.whatsappEnabled) return;
    await this.messaging.sendTemplate({
      accountId,
      to: phone,
      templateKey: whatsAppTemplates.applicationDecision(),
      body: [name, outcome],
    });
  }
}

function maskId(ciphertext: string): string {
  try {
    const plain = decryptField(ciphertext);
    return `••••${plain.slice(-4)}`;
  } catch {
    return "••••";
  }
}
