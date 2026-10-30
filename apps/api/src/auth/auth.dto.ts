import { IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() @Length(7, 20) phone?: string;
  @IsString() @MinLength(8) @MaxLength(100) password: string;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}
