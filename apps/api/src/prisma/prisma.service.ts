import { Injectable, OnModuleDestroy } from "@nestjs/common";
import type { PrismaClient } from "../../prisma-client/client";

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private client: PrismaClient | undefined;

  /**
   * The Prisma 7 client is ESM. Nest compiles to CommonJS, so the
   * client is loaded from the ESM bundle produced by prisma:client.
   */
  async db(): Promise<PrismaClient> {
    if (!this.client) {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error("DATABASE_URL is not set");
      }
      const bundle = "../../prisma-client/client.mjs";
      const { createPrismaClient } = (await import(bundle)) as {
        createPrismaClient: (connectionString: string) => PrismaClient;
      };
      this.client = createPrismaClient(connectionString);
    }
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }
}
