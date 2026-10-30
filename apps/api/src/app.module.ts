import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { join } from "node:path";
import { AuthModule } from "./auth/auth.module";
import { BookingsModule } from "./bookings/bookings.module";
import { BusinessesModule } from "./businesses/businesses.module";
import { CatalogModule } from "./catalog/catalog.module";
import { JwtAuthGuard } from "./common/auth";
import { CommonModule } from "./common/common.module";
import { IS_PG } from "./common/db";
import { DiningModule } from "./dining/dining.module";
import { ALL_ENTITIES, Booking, DiningOrder, Payment } from "./entities";
import { PaymentsModule } from "./payments/payments.module";
import { StatsController } from "./stats/stats.controller";

const database = IS_PG
  ? ({ type: "postgres", url: process.env.DATABASE_URL, entities: ALL_ENTITIES, synchronize: process.env.DB_SYNC !== "false" } as const)
  : ({
      type: "sqljs",
      // empty location = in memory (tests); otherwise a file that is saved after every change
      ...(process.env.DB_LOCATION === "" ? {} : { location: process.env.DB_LOCATION ?? join(process.cwd(), "data", "orderia.sqlite"), autoSave: true }),
      entities: ALL_ENTITIES,
      synchronize: true,
    } as const);

@Module({
  imports: [TypeOrmModule.forRoot(database), TypeOrmModule.forFeature([Booking, DiningOrder, Payment]), CommonModule, AuthModule, BusinessesModule, CatalogModule, BookingsModule, PaymentsModule, DiningModule],
  controllers: [StatsController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
