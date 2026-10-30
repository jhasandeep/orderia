import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Booking, Business, DiningOrder, Payment, PaymentSettings } from "../entities";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { RazorpayGateway } from "./razorpay.gateway";

@Module({
  imports: [TypeOrmModule.forFeature([Payment, PaymentSettings, Business, Booking, DiningOrder])],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayGateway],
  exports: [PaymentsService],
})
export class PaymentsModule {}
