import { CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, UseGuards, applyDecorators } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Membership } from "../entities";
import type { Role } from "./enums";

export interface AuthUser {
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
}

const PUBLIC = "isPublic";

/** No login needed. If a token is sent anyway, the user is still attached (used for "book as yourself"). */
export const Public = () => SetMetadata(PUBLIC, true);

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private reflector: Reflector) {
    super();
  }
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
  handleRequest<T = AuthUser>(err: unknown, user: T | false, _info: unknown, context: ExecutionContext): T {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return (user || null) as T;
    if (err || !user) throw err instanceof Error ? err : new UnauthorizedException("Please sign in.");
    return user;
  }
}

/** The signed-in user (or null on public routes). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | null => ctx.switchToHttp().getRequest().user ?? null);

/** The caller's membership of the business in the URL (set by BusinessAccessGuard). */
export const CurrentMembership = createParamDecorator((_: unknown, ctx: ExecutionContext): Membership | null => ctx.switchToHttp().getRequest().membership ?? null);

const ROLES_KEY = "businessRoles";

@Injectable()
export class BusinessAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(Membership) private memberships: Repository<Membership>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]) ?? [];
    const businessId = req.params.businessId;
    const user: AuthUser | null = req.user;
    if (!user) throw new UnauthorizedException("Please sign in.");
    if (!businessId) throw new ForbiddenException("No business in the request.");
    if (user.isPlatformAdmin) {
      req.membership = { role: "OWNER", businessId, userId: user.userId } as Membership;
      return true;
    }
    const membership = await this.memberships.findOne({ where: { userId: user.userId, businessId } });
    if (!membership) throw new ForbiddenException("You do not belong to this business.");
    if (roles.length > 0 && !roles.includes(membership.role)) throw new ForbiddenException(`This needs one of these roles: ${roles.join(", ")}.`);
    req.membership = membership;
    return true;
  }
}

/** The route belongs to a business (`:businessId`). With no roles, any team member may use it. */
export const BusinessAccess = (...roles: Role[]) => applyDecorators(SetMetadata(ROLES_KEY, roles), UseGuards(BusinessAccessGuard));
