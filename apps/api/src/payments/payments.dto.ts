import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { PAYMENT_METHODS } from "../common/enums";

export class UpdatePaymentSettingsDto {
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsIn(PAYMENT_METHODS, { each: true }) enabledMethods?: (typeof PAYMENT_METHODS)[number][];
  @IsOptional() @IsString() @Matches(/^[\w.\-]{2,}@[a-zA-Z0-9]{2,}$/, { message: "UPI id looks like name@bank" }) upiId?: string;
  @IsOptional() @IsString() @MaxLength(80) upiName?: string;
  @IsOptional() @IsString() @MaxLength(80) razorpayKeyId?: string;
  /** Write-only: it is stored encrypted and never returned. */
  @IsOptional() @IsString() @MaxLength(200) razorpayKeySecret?: string;
  @IsOptional() @IsString() @MaxLength(200) razorpayWebhookSecret?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) advancePercent?: number;
}

export class StartPaymentDto {
  @IsIn(PAYMENT_METHODS) method: (typeof PAYMENT_METHODS)[number];
  /** Bookings: the phone number the booking was made with. */
  @IsOptional() @IsString() phone?: string;
}

export class UpiReferenceDto {
  @IsString() @Matches(/^[A-Za-z0-9]{8,24}$/, { message: "Enter the transaction / UTR number from your UPI app (8 to 24 letters or digits)." }) reference: string;
}

export class RazorpayVerifyDto {
  @IsString() razorpay_order_id: string;
  @IsString() razorpay_payment_id: string;
  @IsString() razorpay_signature: string;
}

export class RecordPaymentDto {
  @IsOptional() @IsString() bookingId?: string;
  @IsOptional() @IsString() orderId?: string;
  @IsIn(["CASH", "UPI_QR"]) method: "CASH" | "UPI_QR";
  @IsOptional() @IsInt() @Min(1) amountMinor?: number;
  @IsOptional() @IsString() @MaxLength(40) reference?: string;
}
