import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { mkdirSync } from "node:fs";
import { AppModule } from "./app.module";
import { addDocs, configureApp } from "./setup";

async function bootstrap() {
  if ((process.env.DB_TYPE ?? "sqljs") !== "postgres") mkdirSync("data", { recursive: true });
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app);
  app.enableCors({ origin: (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(","), credentials: true });
  addDocs(app);
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`Orderia API on http://localhost:${port}/api/v1 (docs: /api/docs)`);
}

bootstrap();
