import { IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { BOOKING_STATUSES } from "../common/enums";

export class CreateBookingDto {
  @IsString() serviceId: string;
  /** Leave empty to be matched with whoever is free ("any provider"). */
  @IsOptional() @IsString() providerId?: string;
  /** Slot bookings: local date and start time in the business time zone. */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be YYYY-MM-DD" }) date?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "time must be HH:mm" }) time?: string;
  /** Stays: check-in and check-out dates. */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "checkIn must be YYYY-MM-DD" }) checkIn?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "checkOut must be YYYY-MM-DD" }) checkOut?: string;
  @IsOptional() @IsInt() @Min(1) @Max(20) rooms?: number;
  @IsOptional() @IsInt() @Min(1) @Max(50) guests?: number;
  @IsString() @MinLength(2) @MaxLength(80) guestName: string;
  @IsString() @Length(7, 20) guestPhone: string;
  @IsOptional() @IsEmail() guestEmail?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class UpdateBookingStatusDto {
  @IsIn(BOOKING_STATUSES) status: (typeof BOOKING_STATUSES)[number];
}

export class CancelDto {
  /** Guests prove it is their booking with the phone number they booked with. */
  @IsOptional() @IsString() phone?: string;
}
