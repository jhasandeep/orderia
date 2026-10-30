import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BusinessAccess, CurrentUser, Public, type AuthUser } from "../common/auth";
import { AddTeamMemberDto, CreateBusinessDto, UpdateBusinessDto } from "./businesses.dto";
import { BusinessesService } from "./businesses.service";

@ApiTags("businesses")
@Controller()
export class BusinessesController {
  constructor(private svc: BusinessesService) {}

  @ApiBearerAuth() @Post("businesses")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBusinessDto) {
    return this.svc.create(user.userId, dto);
  }

  @Public() @Get("businesses")
  list(@Query("type") type?: string, @Query("city") city?: string, @Query("q") q?: string) {
    return this.svc.list({ type, city, q });
  }

  @Public() @Get("businesses/by-slug/:slug")
  bySlug(@Param("slug") slug: string) {
    return this.svc.bySlug(slug);
  }

  @ApiBearerAuth() @BusinessAccess() @Get("businesses/:businessId")
  get(@Param("businessId") id: string) {
    return this.svc.get(id);
  }

  @ApiBearerAuth() @BusinessAccess("OWNER", "MANAGER") @Patch("businesses/:businessId")
  update(@Param("businessId") id: string, @Body() dto: UpdateBusinessDto) {
    return this.svc.update(id, dto);
  }

  @ApiBearerAuth() @BusinessAccess("OWNER", "MANAGER") @Get("businesses/:businessId/team")
  team(@Param("businessId") id: string) {
    return this.svc.team(id);
  }

  @ApiBearerAuth() @BusinessAccess("OWNER") @Post("businesses/:businessId/team")
  addMember(@Param("businessId") id: string, @Body() dto: AddTeamMemberDto) {
    return this.svc.addTeamMember(id, dto);
  }

  @ApiBearerAuth() @BusinessAccess("OWNER") @Delete("businesses/:businessId/team/:membershipId")
  removeMember(@Param("businessId") id: string, @Param("membershipId") membershipId: string) {
    return this.svc.removeTeamMember(id, membershipId);
  }
}
