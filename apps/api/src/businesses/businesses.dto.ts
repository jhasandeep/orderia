import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { BUSINESS_TYPES, MODULES, ROLES } from "../common/enums";

export class CreateBusinessDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsIn(BUSINESS_TYPES) type: (typeof BUSINESS_TYPES)[number];
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "slug can use lowercase letters, numbers and dashes" }) @MaxLength(48) slug?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsArray() @IsIn(MODULES, { each: true }) modules?: (typeof MODULES)[number][];
}

export class UpdateBusinessDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsIn(MODULES, { each: true }) modules?: (typeof MODULES)[number][];
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(5) @Max(240) slotIntervalMinutes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10080) minNoticeMinutes?: number;
  @IsOptional() @IsBoolean() autoConfirm?: boolean;
}

export class AddTeamMemberDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() @Length(7, 20) phone?: string;
  /** Used when the person has no Orderia account yet. */
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsIn(ROLES.filter((r) => r !== "OWNER")) role: Exclude<(typeof ROLES)[number], "OWNER">;
}
