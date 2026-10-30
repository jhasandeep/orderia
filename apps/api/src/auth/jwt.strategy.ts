import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AuthUser } from "../common/auth";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: process.env.JWT_SECRET ?? "dev-only-jwt-secret-change-me" });
  }
  validate(payload: { sub: string; email: string; admin?: boolean }): AuthUser {
    return { userId: payload.sub, email: payload.email, isPlatformAdmin: Boolean(payload.admin) };
  }
}
