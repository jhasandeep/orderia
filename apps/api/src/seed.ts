import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { mkdirSync } from "node:fs";
import { AppModule } from "./app.module";
import { AuthService } from "./auth/auth.service";
import { BusinessesService } from "./businesses/businesses.service";
import { CatalogService } from "./catalog/catalog.service";
import { DiningService } from "./dining/dining.service";
import { PaymentsService } from "./payments/payments.service";
import { DataSource } from "typeorm";
import { User } from "./entities";

/** Demo data so there is something to click on right after installing: `npm run seed`. */
async function seed() {
  if ((process.env.DB_TYPE ?? "sqljs") !== "postgres") mkdirSync("data", { recursive: true });
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
  const ds = app.get(DataSource);
  if (await ds.getRepository(User).exists({ where: { email: "owner@orderia.dev" } })) {
    console.log("Demo data already exists: nothing to do.");
    await app.close();
    return;
  }
  const auth = app.get(AuthService);
  const businesses = app.get(BusinessesService);
  const catalog = app.get(CatalogService);
  const dining = app.get(DiningService);
  const payments = app.get(PaymentsService);

  const owner = (await auth.register({ name: "Demo Owner", email: "owner@orderia.dev", password: "password123" })).user;
  const weekdays = (start: string, end: string, days = [1, 2, 3, 4, 5, 6]) => ({ rules: days.map((weekday) => ({ weekday, startTime: start, endTime: end })) });
  const upi = { enabledMethods: ["CASH" as const, "UPI_QR" as const], upiId: "demo@okbank", upiName: "Orderia Demo" };

  // Salon: slots with stylists
  const salon = await businesses.create(owner.id, { name: "Glow Salon", type: "SALON", city: "Delhi", description: "Haircuts, colour and styling by experienced stylists.", phone: "+91 98100 00001", address: "12 Market Road, Saket" });
  const cut = await catalog.createService(salon.id, { name: "Haircut & Styling", durationMinutes: 45, priceMinor: 60000 });
  const colour = await catalog.createService(salon.id, { name: "Hair Colour", durationMinutes: 90, priceMinor: 250000 });
  const asha = await catalog.createProvider(salon.id, { name: "Asha", title: "Senior stylist", serviceIds: [cut.id, colour.id] });
  const ben = await catalog.createProvider(salon.id, { name: "Ben", title: "Stylist", serviceIds: [cut.id] });
  await catalog.setAvailability(salon.id, asha.id, weekdays("10:00", "19:00"));
  await catalog.setAvailability(salon.id, ben.id, weekdays("11:00", "20:00", [2, 3, 4, 5, 6, 0]));
  await payments.updateSettings(salon.id, upi);

  // Parlour
  const parlour = await businesses.create(owner.id, { name: "Rose Beauty Parlour", type: "PARLOUR", city: "Delhi", description: "Facials, waxing and bridal makeup.", phone: "+91 98100 00002" });
  const facial = await catalog.createService(parlour.id, { name: "Classic Facial", durationMinutes: 60, priceMinor: 120000 });
  const wax = await catalog.createService(parlour.id, { name: "Full Arms Waxing", durationMinutes: 30, priceMinor: 35000 });
  const rose = await catalog.createProvider(parlour.id, { name: "Neha", title: "Beautician", serviceIds: [facial.id, wax.id] });
  await catalog.setAvailability(parlour.id, rose.id, weekdays("10:00", "18:00"));

  // Clinic: doctors
  const clinic = await businesses.create(owner.id, { name: "City Care Clinic", type: "DOCTOR", city: "Mumbai", description: "General physician and skin specialist. Walk-ins welcome.", phone: "+91 98100 00003" });
  const consult = await catalog.createService(clinic.id, { name: "General Consultation", durationMinutes: 20, priceMinor: 50000 });
  const skin = await catalog.createService(clinic.id, { name: "Skin Consultation", durationMinutes: 30, priceMinor: 80000 });
  const drRao = await catalog.createProvider(clinic.id, { name: "Dr. Rao", title: "General Physician", serviceIds: [consult.id] });
  const drMehta = await catalog.createProvider(clinic.id, { name: "Dr. Mehta", title: "Dermatologist", serviceIds: [skin.id, consult.id] });
  await catalog.setAvailability(clinic.id, drRao.id, weekdays("09:00", "13:00", [1, 2, 3, 4, 5]));
  await catalog.setAvailability(clinic.id, drMehta.id, weekdays("16:00", "20:00", [1, 3, 5]));
  await payments.updateSettings(clinic.id, { ...upi, advancePercent: 30 });
  await businesses.update(clinic.id, { slotIntervalMinutes: 20 });

  // Hotel: rooms by the night, plus a restaurant with QR tables
  const hotel = await businesses.create(owner.id, { name: "Sea View Hotel", type: "HOTEL", city: "Goa", description: "Rooms with a sea view, a pool and a restaurant.", phone: "+91 98100 00004", address: "Calangute Beach Road" });
  await catalog.createService(hotel.id, { name: "Deluxe Room", mode: "STAY", priceMinor: 450000, capacity: 5, description: "King bed, balcony, breakfast included." });
  await catalog.createService(hotel.id, { name: "Suite", mode: "STAY", priceMinor: 900000, capacity: 2, description: "Two rooms, sea-facing balcony." });
  await payments.updateSettings(hotel.id, upi);

  const restaurant = await businesses.create(owner.id, { name: "Spice Hub", type: "RESTAURANT", city: "Mumbai", description: "North Indian and street food. Scan the QR on your table to order.", phone: "+91 98100 00005" });
  for (const [label, seats] of [["T1", 2], ["T2", 2], ["T3", 4], ["T4", 4], ["T5", 6], ["T6", 8]] as const) await dining.createTable(restaurant.id, { label, seats });
  const starters = await dining.createCategory(restaurant.id, { name: "Starters", sort: 1 });
  const mains = await dining.createCategory(restaurant.id, { name: "Mains", sort: 2 });
  const drinks = await dining.createCategory(restaurant.id, { name: "Drinks", sort: 3 });
  const menu: [string, number, string, boolean][] = [
    ["Paneer Tikka", 24000, starters.id, true],
    ["Chicken 65", 26000, starters.id, false],
    ["Veg Spring Rolls", 18000, starters.id, true],
    ["Butter Chicken", 32000, mains.id, false],
    ["Dal Makhani", 24000, mains.id, true],
    ["Chicken Biryani", 28000, mains.id, false],
    ["Butter Naan", 6000, mains.id, true],
    ["Sweet Lassi", 8000, drinks.id, true],
    ["Masala Chai", 4000, drinks.id, true],
    ["Fresh Lime Soda", 7000, drinks.id, true],
  ];
  for (const [name, priceMinor, categoryId, veg] of menu) await dining.createItem(restaurant.id, { name, priceMinor, categoryId, veg });
  await payments.updateSettings(restaurant.id, upi);

  // team members with different jobs
  for (const [name, email, role, id] of [
    ["Kitchen Staff", "kitchen@orderia.dev", "KITCHEN", restaurant.id],
    ["Front Desk", "reception@orderia.dev", "RECEPTION", salon.id],
    ["Branch Manager", "manager@orderia.dev", "MANAGER", salon.id],
  ] as const) await businesses.addTeamMember(id, { name, email, role, password: "password123" });

  console.log("Demo data created. Sign in with owner@orderia.dev / password123 (also kitchen@, reception@, manager@orderia.dev).");
  console.log(`Public pages: /b/${salon.slug}, /b/${parlour.slug}, /b/${clinic.slug}, /b/${hotel.slug}, /b/${restaurant.slug}`);
  await app.close();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
