import { Injectable, Module, OnModuleInit } from "@nestjs/common";
import { assertRequiredEnv } from "./env";

@Injectable()
export class EnvCheck implements OnModuleInit {
  onModuleInit(): void {
    assertRequiredEnv();
  }
}

@Module({ providers: [EnvCheck] })
export class EnvModule {}
