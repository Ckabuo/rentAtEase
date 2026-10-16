import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../../prisma/types";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(
    db: Db,
    input: {
      accountId: string;
      actorUserId?: string | null;
      action: string;
      entityType: string;
      entityId: string;
      before?: unknown;
      after?: unknown;
    },
  ): Promise<void> {
    await db.auditLog.create({
      data: {
        accountId: input.accountId,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before === undefined ? undefined : (input.before as object),
        after: input.after === undefined ? undefined : (input.after as object),
      },
    });
  }

  async list(accountId: string) {
    const db = await this.prisma.db();
    return db.auditLog.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}
