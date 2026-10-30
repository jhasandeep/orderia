import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BusinessAccess } from "../common/auth";
import { CreateProviderDto, CreateServiceDto, SetAvailabilityDto, TimeOffDto, UpdateProviderDto, UpdateServiceDto } from "./catalog.dto";
import { CatalogService } from "./catalog.service";

@ApiTags("catalog")
@ApiBearerAuth()
@Controller("businesses/:businessId")
export class CatalogController {
  constructor(private svc: CatalogService) {}

  @BusinessAccess() @Get("services")
  services(@Param("businessId") id: string) {
    return this.svc.listServices(id);
  }
  @BusinessAccess("OWNER", "MANAGER") @Post("services")
  createService(@Param("businessId") id: string, @Body() dto: CreateServiceDto) {
    return this.svc.createService(id, dto);
  }
  @BusinessAccess("OWNER", "MANAGER") @Patch("services/:serviceId")
  updateService(@Param("businessId") id: string, @Param("serviceId") sid: string, @Body() dto: UpdateServiceDto) {
    return this.svc.updateService(id, sid, dto);
  }
  @BusinessAccess("OWNER", "MANAGER") @Delete("services/:serviceId")
  deleteService(@Param("businessId") id: string, @Param("serviceId") sid: string) {
    return this.svc.deleteService(id, sid);
  }

  @BusinessAccess() @Get("providers")
  providers(@Param("businessId") id: string) {
    return this.svc.listProviders(id);
  }
  @BusinessAccess("OWNER", "MANAGER") @Post("providers")
  createProvider(@Param("businessId") id: string, @Body() dto: CreateProviderDto) {
    return this.svc.createProvider(id, dto);
  }
  @BusinessAccess("OWNER", "MANAGER") @Patch("providers/:providerId")
  updateProvider(@Param("businessId") id: string, @Param("providerId") pid: string, @Body() dto: UpdateProviderDto) {
    return this.svc.updateProvider(id, pid, dto);
  }
  @BusinessAccess("OWNER", "MANAGER") @Delete("providers/:providerId")
  deleteProvider(@Param("businessId") id: string, @Param("providerId") pid: string) {
    return this.svc.deleteProvider(id, pid);
  }

  @BusinessAccess("OWNER", "MANAGER") @Put("providers/:providerId/availability")
  setAvailability(@Param("businessId") id: string, @Param("providerId") pid: string, @Body() dto: SetAvailabilityDto) {
    return this.svc.setAvailability(id, pid, dto);
  }
  @BusinessAccess() @Get("providers/:providerId/time-off")
  timeOff(@Param("businessId") id: string, @Param("providerId") pid: string) {
    return this.svc.listTimeOff(id, pid);
  }
  @BusinessAccess("OWNER", "MANAGER") @Post("providers/:providerId/time-off")
  addTimeOff(@Param("businessId") id: string, @Param("providerId") pid: string, @Body() dto: TimeOffDto) {
    return this.svc.addTimeOff(id, pid, dto);
  }
  @BusinessAccess("OWNER", "MANAGER") @Delete("providers/:providerId/time-off/:timeOffId")
  removeTimeOff(@Param("businessId") id: string, @Param("providerId") pid: string, @Param("timeOffId") tid: string) {
    return this.svc.removeTimeOff(id, pid, tid);
  }
}
