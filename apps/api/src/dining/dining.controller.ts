import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BusinessAccess, Public } from "../common/auth";
import { BusinessesService } from "../businesses/businesses.service";
import { CategoryDto, CreateMenuItemDto, CreateTableDto, PlaceOrderDto, ReserveTableDto, UpdateMenuItemDto, UpdateOrderStatusDto, UpdateReservationStatusDto, UpdateTableDto } from "./dining.dto";
import { DiningService } from "./dining.service";

/** What a guest does after scanning a table's QR code. */
@ApiTags("dining-public")
@Controller("public")
export class PublicDiningController {
  constructor(
    private dining: DiningService,
    private businesses: BusinessesService,
  ) {}

  @Public() @Get("tables/:token")
  page(@Param("token") token: string) {
    return this.dining.tablePage(token);
  }

  @Public() @Post("tables/:token/orders")
  order(@Param("token") token: string, @Body() dto: PlaceOrderDto) {
    return this.dining.placeOrder(token, dto);
  }

  @Public() @Get("orders/:code")
  status(@Param("code") code: string) {
    return this.dining.orderByCode(code);
  }

  @Public() @Post("businesses/:slug/table-reservations")
  async reserve(@Param("slug") slug: string, @Body() dto: ReserveTableDto) {
    return this.dining.reserve(await this.businesses.bySlug(slug), dto);
  }
}

@ApiTags("dining")
@ApiBearerAuth()
@Controller("businesses/:businessId/dining")
export class DiningController {
  constructor(
    private dining: DiningService,
    private businesses: BusinessesService,
  ) {}

  // tables
  @BusinessAccess("OWNER", "MANAGER", "RECEPTION") @Get("tables")
  tables(@Param("businessId") id: string) {
    return this.dining.listTables(id);
  }
  @BusinessAccess("OWNER", "MANAGER") @Post("tables")
  createTable(@Param("businessId") id: string, @Body() dto: CreateTableDto) {
    return this.dining.createTable(id, dto);
  }
  @BusinessAccess("OWNER", "MANAGER") @Patch("tables/:tableId")
  updateTable(@Param("businessId") id: string, @Param("tableId") tid: string, @Body() dto: UpdateTableDto) {
    return this.dining.updateTable(id, tid, dto);
  }
  @BusinessAccess("OWNER", "MANAGER") @Get("tables/:tableId/qr")
  qr(@Param("businessId") id: string, @Param("tableId") tid: string) {
    return this.dining.qr(id, tid);
  }
  @BusinessAccess("OWNER", "MANAGER") @Post("tables/:tableId/rotate-qr")
  rotate(@Param("businessId") id: string, @Param("tableId") tid: string) {
    return this.dining.rotateToken(id, tid);
  }

  // menu
  @BusinessAccess("OWNER", "MANAGER", "RECEPTION", "KITCHEN") @Get("menu")
  menu(@Param("businessId") id: string) {
    return this.dining.menu(id);
  }
  @BusinessAccess("OWNER", "MANAGER") @Post("categories")
  createCategory(@Param("businessId") id: string, @Body() dto: CategoryDto) {
    return this.dining.createCategory(id, dto);
  }
  @BusinessAccess("OWNER", "MANAGER") @Patch("categories/:categoryId")
  updateCategory(@Param("businessId") id: string, @Param("categoryId") cid: string, @Body() dto: CategoryDto) {
    return this.dining.updateCategory(id, cid, dto);
  }
  @BusinessAccess("OWNER", "MANAGER") @Delete("categories/:categoryId")
  deleteCategory(@Param("businessId") id: string, @Param("categoryId") cid: string) {
    return this.dining.deleteCategory(id, cid);
  }
  @BusinessAccess("OWNER", "MANAGER") @Post("items")
  createItem(@Param("businessId") id: string, @Body() dto: CreateMenuItemDto) {
    return this.dining.createItem(id, dto);
  }
  /** The kitchen may switch an item off when it runs out. */
  @BusinessAccess("OWNER", "MANAGER", "KITCHEN") @Patch("items/:itemId")
  updateItem(@Param("businessId") id: string, @Param("itemId") iid: string, @Body() dto: UpdateMenuItemDto) {
    return this.dining.updateItem(id, iid, dto);
  }
  @BusinessAccess("OWNER", "MANAGER") @Delete("items/:itemId")
  deleteItem(@Param("businessId") id: string, @Param("itemId") iid: string) {
    return this.dining.deleteItem(id, iid);
  }

  // orders (the kitchen board)
  @BusinessAccess("OWNER", "MANAGER", "RECEPTION", "KITCHEN") @Get("orders")
  orders(@Param("businessId") id: string, @Query("filter") filter?: string) {
    return this.dining.listOrders(id, filter === "all" ? "all" : "active");
  }
  @BusinessAccess("OWNER", "MANAGER", "RECEPTION", "KITCHEN") @Patch("orders/:orderId/status")
  orderStatus(@Param("businessId") id: string, @Param("orderId") oid: string, @Body() dto: UpdateOrderStatusDto) {
    return this.dining.setOrderStatus(id, oid, dto.status);
  }

  // table reservations
  @BusinessAccess("OWNER", "MANAGER", "RECEPTION") @Get("reservations")
  async reservations(@Param("businessId") id: string, @Query("date") date?: string) {
    return this.dining.listReservations(await this.businesses.get(id), date);
  }
  @BusinessAccess("OWNER", "MANAGER", "RECEPTION") @Post("reservations")
  async reserve(@Param("businessId") id: string, @Body() dto: ReserveTableDto) {
    return this.dining.reserve(await this.businesses.get(id), dto);
  }
  @BusinessAccess("OWNER", "MANAGER", "RECEPTION") @Patch("reservations/:reservationId/status")
  reservationStatus(@Param("businessId") id: string, @Param("reservationId") rid: string, @Body() dto: UpdateReservationStatusDto) {
    return this.dining.setReservationStatus(id, rid, dto.status);
  }
}
