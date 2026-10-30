import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BusinessesModule } from "../businesses/businesses.module";
import { Business, DiningOrder, DiningOrderItem, DiningTable, MenuCategory, MenuItem, Payment, PaymentSettings, TableReservation } from "../entities";
import { DiningController, PublicDiningController } from "./dining.controller";
import { DiningService } from "./dining.service";

@Module({
  imports: [TypeOrmModule.forFeature([Business, DiningTable, MenuCategory, MenuItem, DiningOrder, DiningOrderItem, TableReservation, PaymentSettings, Payment]), BusinessesModule],
  controllers: [PublicDiningController, DiningController],
  providers: [DiningService],
  exports: [DiningService],
})
export class DiningModule {}
