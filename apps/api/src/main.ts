import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: [
      process.env.WEB_ORIGIN ?? "http://localhost:3000",
      process.env.MARKETING_ORIGIN ?? "http://localhost:3001",
    ],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-plan-admin-secret"],
  });
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle("Rent@Ease API")
    .setDescription("REST API for Rent@Ease")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen(port);
}

void bootstrap();
