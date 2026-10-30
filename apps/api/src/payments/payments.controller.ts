import { Body, Controller, Get, Headers, Param, Post, Put, Query, RawBodyRequest, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { BusinessAccess, Public } from "../common/auth";
import { RazorpayVerifyDto, RecordPaymentDto, StartPaymentDto, UpdatePaymentSettingsDto, UpiReferenceDto } from "./payments.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("payments")
@Controller()
export class PaymentsController {
  constructor(private svc: PaymentsService) {}

  // ---- what the customer does
  @Public() @Post("public/bookings/:code/payments")
  payBooking(@Param("code") code: string, @Body() dto: StartPaymentDto) {
    return this.svc.forBooking(code, dto.phone ?? "", dto);
  }

  @Public() @Post("public/orders/:code/payments")
  payOrder(@Param("code") code: string, @Body() dto: StartPaymentDto) {
    return this.svc.forOrder(code, dto);
  }

  @Public() @Post("public/payments/:id/upi-reference")
  upiReference(@Param("id") id: string, @Body() dto: UpiReferenceDto) {
    return this.svc.submitUpiReference(id, dto.reference);
  }

  @Public() @Post("public/payments/razorpay/verify")
  verify(@Body() dto: RazorpayVerifyDto) {
    return this.svc.verifyRazorpay(dto.razorpay_order_id, dto.razorpay_payment_id, dto.razorpay_signature);
  }

  @Public() @Post("public/webhooks/razorpay/:businessId")
  webhook(@Param("businessId") businessId: string, @Req() req: RawBodyRequest<Request>, @Headers("x-razorpay-signature") signature: string) {
    return this.svc.razorpayWebhook(businessId, req.rawBody ?? Buffer.from(""), signature);
  }

  // ---- what the team does
  @ApiBearerAuth() @BusinessAccess("OWNER", "MANAGER") @Get("businesses/:businessId/payment-settings")
  settings(@Param("businessId") id: string) {
    return this.svc.getSettings(id);
  }

  @ApiBearerAuth() @BusinessAccess("OWNER") @Put("businesses/:businessId/payment-settings")
  updateSettings(@Param("businessId") id: string, @Body() dto: UpdatePaymentSettingsDto) {
    return this.svc.updateSettings(id, dto);
  }

  @ApiBearerAuth() @BusinessAccess("OWNER", "MANAGER", "RECEPTION") @Get("businesses/:businessId/payments")
  list(@Param("businessId") id: string, @Query("status") status?: string) {
    return this.svc.list(id, status);
  }

  @ApiBearerAuth() @BusinessAccess("OWNER", "MANAGER", "RECEPTION") @Post("businesses/:businessId/payments")
  record(@Param("businessId") id: string, @Body() dto: RecordPaymentDto) {
    return this.svc.record(id, dto);
  }

  @ApiBearerAuth() @BusinessAccess("OWNER", "MANAGER", "RECEPTION") @Post("businesses/:businessId/payments/:paymentId/confirm")
  confirm(@Param("businessId") id: string, @Param("paymentId") pid: string) {
    return this.svc.confirm(id, pid);
  }

  @ApiBearerAuth() @BusinessAccess("OWNER", "MANAGER", "RECEPTION") @Post("businesses/:businessId/payments/:paymentId/reject")
  reject(@Param("businessId") id: string, @Param("paymentId") pid: string) {
    return this.svc.reject(id, pid);
  }
}
