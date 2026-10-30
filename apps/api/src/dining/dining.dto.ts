import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { ORDER_STATUSES, RESERVATION_STATUSES } from "../common/enums";

export class CreateTableDto {
  @IsString() @MinLength(1) @MaxLength(30) label: string;
  @IsOptional() @IsInt() @Min(1) @Max(50) seats?: number;
}

export class UpdateTableDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(30) label?: string;
  @IsOptional() @IsInt() @Min(1) @Max(50) seats?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CategoryDto {
  @IsString() @MinLength(1) @MaxLength(60) name: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) sort?: number;
}

export class CreateMenuItemDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsInt() @Min(0) @Max(10_000_000) priceMinor: number;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsBoolean() veg?: boolean;
  @IsOptional() @IsBoolean() available?: boolean;
}

export class UpdateMenuItemDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) priceMinor?: number;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsBoolean() veg?: boolean;
  @IsOptional() @IsBoolean() available?: boolean;
}

export class OrderLineDto {
  @IsString() menuItemId: string;
  @IsInt() @Min(1) @Max(50) quantity: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class PlaceOrderDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => OrderLineDto) items: OrderLineDto[];
  @IsOptional() @IsString() @MaxLength(80) guestName?: string;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
}

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES) status: (typeof ORDER_STATUSES)[number];
}

export class ReserveTableDto {
  @IsString() @MinLength(2) @MaxLength(80) guestName: string;
  @IsString() @Length(7, 20) guestPhone: string;
  @IsInt() @Min(1) @Max(50) partySize: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be YYYY-MM-DD" }) date: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "time must be HH:mm" }) time: string;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
}

export class UpdateReservationStatusDto {
  @IsIn(RESERVATION_STATUSES) status: (typeof RESERVATION_STATUSES)[number];
}
