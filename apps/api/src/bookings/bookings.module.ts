import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BusinessesModule } from "../businesses/businesses.module";
import { CatalogModule } from "../catalog/catalog.module";
import { AvailabilityRule, Booking, Business, PaymentSettings, Provider, Service, TimeOff } from "../entities";
import { AvailabilityService } from "./availability.service";
import { MyBookingsController, PublicBookingsController, StaffBookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Service, Provider, AvailabilityRule, TimeOff, Business, PaymentSettings]), BusinessesModule, CatalogModule],
  controllers: [PublicBookingsController, MyBookingsController, StaffBookingsController],
  providers: [BookingsService, AvailabilityService],
  exports: [BookingsService, AvailabilityService],
})
export class BookingsModule {}
