import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { SERVICE_MODES } from "../common/enums";

export class CreateServiceDto {
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsIn(SERVICE_MODES) mode?: (typeof SERVICE_MODES)[number];
  @IsOptional() @IsInt() @Min(5) @Max(1440) durationMinutes?: number;
  /** In paise (for example 49900 = ₹499). */
  @IsInt() @Min(0) @Max(100_000_000) priceMinor: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000) capacity?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateServiceDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsInt() @Min(5) @Max(1440) durationMinutes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) priceMinor?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000) capacity?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateProviderDto {
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(100) title?: string;
  @IsOptional() @IsString() @MaxLength(1000) bio?: string;
  @IsArray() @IsString({ each: true }) serviceIds: string[];
  /** Link to a team member's login so they see their own bookings. */
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateProviderDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(100) title?: string;
  @IsOptional() @IsString() @MaxLength(1000) bio?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) serviceIds?: string[];
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class RuleDto {
  @IsInt() @Min(0) @Max(6) weekday: number;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "use HH:mm" }) startTime: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "use HH:mm" }) endTime: string;
}

export class SetAvailabilityDto {
  @IsArray() @ArrayMaxSize(70) @ValidateNested({ each: true }) @Type(() => RuleDto) rules: RuleDto[];
}

export class TimeOffDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "use YYYY-MM-DD" }) date: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}
