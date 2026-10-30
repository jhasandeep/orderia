import { INestApplication } from "@nestjs/common";
import { addDay, auth, createApp, http, nextWeekday, signUp } from "./helpers";

describe("appointments", () => {
  let app: INestApplication;
  let owner: Awaited<ReturnType<typeof signUp>>;
  let business: { id: string; slug: string };
  let service: { id: string };
  let drA: { id: string };
  let drB: { id: string };
  const monday = nextWeekday(1);

  beforeAll(async () => {
    ({ app } = await createApp());
    owner = await signUp(app, "Salon Owner");
  });
  afterAll(() => app.close());

  it("registers, rejects duplicates and wrong passwords, and returns the profile", async () => {
    const dup = await http(app).post("/api/v1/auth/register").send({ name: "Dup", email: owner.email, password: "password123" });
    expect(dup.status).toBe(409);
    await http(app).post("/api/v1/auth/login").send({ email: owner.email, password: "wrong-password" }).expect(401);
    await http(app).post("/api/v1/auth/login").send({ email: "nobody@example.com", password: "password123" }).expect(401);
    const login = await http(app).post("/api/v1/auth/login").send({ email: owner.email.toUpperCase(), password: "password123" }).expect(201);
    expect(login.body.token).toBeTruthy();
    const me = await http(app).get("/api/v1/auth/me").set(auth(owner.token)).expect(200);
    expect(me.body.user.email).toBe(owner.email);
    expect(me.body.user.passwordHash).toBeUndefined();
    await http(app).get("/api/v1/auth/me").expect(401);
    await http(app).post("/api/v1/auth/register").send({ name: "X", email: "bad", password: "short" }).expect(400);
  });

  it("creates a business and makes the creator its owner", async () => {
    const res = await http(app).post("/api/v1/businesses").set(auth(owner.token)).send({ name: "Glow Salon", type: "SALON", city: "Delhi" }).expect(201);
    business = res.body;
    expect(business.slug).toBe("glow-salon");
    expect(res.body.modules).toEqual(["APPOINTMENTS"]);
    const clash = await http(app).post("/api/v1/businesses").set(auth(owner.token)).send({ name: "Glow Salon", type: "SALON", slug: "glow-salon" });
    expect(clash.status).toBe(409);
    const auto = await http(app).post("/api/v1/businesses").set(auth(owner.token)).send({ name: "Glow Salon", type: "PARLOUR" }).expect(201);
    expect(auto.body.slug).toMatch(/^glow-salon-[a-z0-9]{4}$/);
    const me = await http(app).get("/api/v1/auth/me").set(auth(owner.token));
    expect(me.body.memberships.map((m: { role: string }) => m.role)).toEqual(["OWNER", "OWNER", "OWNER"].slice(0, me.body.memberships.length));
  });

  it("lists businesses publicly with filters", async () => {
    const all = await http(app).get("/api/v1/businesses").expect(200);
    expect(all.body.length).toBeGreaterThanOrEqual(2);
    const salons = await http(app).get("/api/v1/businesses?type=SALON&q=glow").expect(200);
    expect(salons.body.every((b: { type: string }) => b.type === "SALON")).toBe(true);
    expect((await http(app).get("/api/v1/businesses?type=DOCTOR")).body).toEqual([]);
  });

  it("keeps other people out of a business", async () => {
    const stranger = await signUp(app, "Stranger");
    await http(app).get(`/api/v1/businesses/${business.id}`).set(auth(stranger.token)).expect(403);
    await http(app).post(`/api/v1/businesses/${business.id}/services`).set(auth(stranger.token)).send({ name: "Hack", priceMinor: 1 }).expect(403);
    await http(app).get(`/api/v1/businesses/${business.id}/bookings`).expect(401);
  });

  it("sets up services, providers and weekly hours", async () => {
    service = (await http(app).post(`/api/v1/businesses/${business.id}/services`).set(auth(owner.token)).send({ name: "Haircut", durationMinutes: 30, priceMinor: 50000 }).expect(201)).body;
    await http(app).post(`/api/v1/businesses/${business.id}/services`).set(auth(owner.token)).send({ name: "x", priceMinor: -5 }).expect(400);
    drA = (await http(app).post(`/api/v1/businesses/${business.id}/providers`).set(auth(owner.token)).send({ name: "Asha", title: "Senior stylist", serviceIds: [service.id] }).expect(201)).body;
    drB = (await http(app).post(`/api/v1/businesses/${business.id}/providers`).set(auth(owner.token)).send({ name: "Ben", serviceIds: [service.id] }).expect(201)).body;
    await http(app).post(`/api/v1/businesses/${business.id}/providers`).set(auth(owner.token)).send({ name: "Bad", serviceIds: ["not-a-service"] }).expect(400);
    const hours = { rules: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "09:00", endTime: "12:00" })) };
    await http(app).put(`/api/v1/businesses/${business.id}/providers/${drA.id}/availability`).set(auth(owner.token)).send(hours).expect(200);
    await http(app).put(`/api/v1/businesses/${business.id}/providers/${drB.id}/availability`).set(auth(owner.token)).send(hours).expect(200);
    const bad = await http(app).put(`/api/v1/businesses/${business.id}/providers/${drA.id}/availability`).set(auth(owner.token)).send({ rules: [{ weekday: 1, startTime: "12:00", endTime: "09:00" }] });
    expect(bad.status).toBe(400);
    const overlap = await http(app).put(`/api/v1/businesses/${business.id}/providers/${drA.id}/availability`).set(auth(owner.token)).send({ rules: [{ weekday: 1, startTime: "09:00", endTime: "11:00" }, { weekday: 1, startTime: "10:00", endTime: "12:00" }] });
    expect(overlap.status).toBe(400);
  });

  it("shows the public business page", async () => {
    const page = await http(app).get(`/api/v1/public/businesses/${business.slug}`).expect(200);
    expect(page.body.services).toHaveLength(1);
    expect(page.body.providers.map((p: { name: string }) => p.name)).toEqual(["Asha", "Ben"]);
    expect(page.body.payment.methods).toEqual(["CASH"]);
    expect(JSON.stringify(page.body)).not.toMatch(/secret|passwordHash/i);
  });

  it("offers slots in the business time zone", async () => {
    const res = await http(app).get(`/api/v1/public/businesses/${business.slug}/availability?serviceId=${service.id}&date=${monday}&providerId=${drA.id}`).expect(200);
    const starts: string[] = res.body.slots.map((s: { start: string }) => s.start);
    expect(starts).toHaveLength(6); // 09:00, 09:30 … 11:30
    expect(starts[0]).toBe(`${monday}T03:30:00.000Z`); // 09:00 in India
    expect(starts.at(-1)).toBe(`${monday}T06:00:00.000Z`); // 11:30 in India
    // a Sunday has no hours
    const sunday = nextWeekday(0);
    expect((await http(app).get(`/api/v1/public/businesses/${business.slug}/availability?serviceId=${service.id}&date=${sunday}`)).body.slots).toEqual([]);
    await http(app).get(`/api/v1/public/businesses/${business.slug}/availability?serviceId=${service.id}&date=nope`).expect(400);
  });

  it("hides a day when the provider has time off", async () => {
    const tuesday = nextWeekday(2);
    await http(app).post(`/api/v1/businesses/${business.id}/providers/${drA.id}/time-off`).set(auth(owner.token)).send({ date: tuesday, reason: "Holiday" }).expect(201);
    const res = await http(app).get(`/api/v1/public/businesses/${business.slug}/availability?serviceId=${service.id}&date=${tuesday}&providerId=${drA.id}`).expect(200);
    expect(res.body.slots).toEqual([]);
    const any = await http(app).get(`/api/v1/public/businesses/${business.slug}/availability?serviceId=${service.id}&date=${tuesday}`).expect(200);
    expect(any.body.slots.length).toBe(6); // Ben still works
    expect(any.body.slots.every((s: { providerId: string }) => s.providerId === drB.id)).toBe(true);
  });

  const guest = { guestName: "Ravi Kumar", guestPhone: "+91 98765 43210" };
  let code: string;

  it("books a slot and stops offering it", async () => {
    const res = await http(app).post(`/api/v1/public/businesses/${business.slug}/bookings`).send({ serviceId: service.id, providerId: drA.id, date: monday, time: "09:30", ...guest }).expect(201);
    code = res.body.code;
    expect(res.body.status).toBe("CONFIRMED");
    expect(res.body.totalMinor).toBe(50000);
    expect(res.body.provider.name).toBe("Asha");
    expect(res.body.startAt).toBe(`${monday}T04:00:00.000Z`);
    const after = await http(app).get(`/api/v1/public/businesses/${business.slug}/availability?serviceId=${service.id}&date=${monday}&providerId=${drA.id}`);
    const starts = after.body.slots.map((s: { start: string }) => s.start);
    expect(starts).not.toContain(`${monday}T04:00:00.000Z`); // 09:30 taken
  });
  it("does not block the slot just before a booking", async () => {
    const res = await http(app).get(`/api/v1/public/businesses/${business.slug}/availability?serviceId=${service.id}&date=${monday}&providerId=${drA.id}`);
    expect(res.body.slots.map((s: { start: string }) => s.start)).toContain(`${monday}T03:30:00.000Z`);
  });

  it("refuses to double-book the same provider and slot", async () => {
    const res = await http(app).post(`/api/v1/public/businesses/${business.slug}/bookings`).send({ serviceId: service.id, providerId: drA.id, date: monday, time: "09:30", guestName: "Other", guestPhone: "9000000001" });
    expect(res.status).toBe(409);
  });

  it("gives 'any provider' bookings to whoever is free, then runs out", async () => {
    const first = await http(app).post(`/api/v1/public/businesses/${business.slug}/bookings`).send({ serviceId: service.id, date: monday, time: "09:30", guestName: "Second", guestPhone: "9000000002" }).expect(201);
    expect(first.body.provider.name).toBe("Ben"); // Asha is busy
    const third = await http(app).post(`/api/v1/public/businesses/${business.slug}/bookings`).send({ serviceId: service.id, date: monday, time: "09:30", guestName: "Third", guestPhone: "9000000003" });
    expect(third.status).toBe(409);
  });

  it("books two people at the same moment only once (race)", async () => {
    const tuesday = nextWeekday(2);
    const [a, b] = await Promise.all([
      http(app).post(`/api/v1/public/businesses/${business.slug}/bookings`).send({ serviceId: service.id, providerId: drB.id, date: tuesday, time: "10:00", guestName: "Racer A", guestPhone: "9000000010" }),
      http(app).post(`/api/v1/public/businesses/${business.slug}/bookings`).send({ serviceId: service.id, providerId: drB.id, date: tuesday, time: "10:00", guestName: "Racer B", guestPhone: "9000000011" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });

  it("rejects times that are not offered and bad input", async () => {
    await http(app).post(`/api/v1/public/businesses/${business.slug}/bookings`).send({ serviceId: service.id, date: monday, time: "13:00", ...guest }).expect(409);
    await http(app).post(`/api/v1/public/businesses/${business.slug}/bookings`).send({ serviceId: service.id, date: monday, ...guest }).expect(400);
    await http(app).post(`/api/v1/public/businesses/${business.slug}/bookings`).send({ serviceId: service.id, date: monday, time: "10:00", guestName: "A", guestPhone: "1" }).expect(400);
    await http(app).post(`/api/v1/public/businesses/${business.slug}/bookings`).send({ serviceId: service.id, date: monday, time: "10:00", ...guest, hack: true }).expect(400);
    await http(app).post(`/api/v1/public/businesses/${business.slug}/bookings`).send({ serviceId: "missing", date: monday, time: "10:00", ...guest }).expect(404);
    const past = await http(app).post(`/api/v1/public/businesses/${business.slug}/bookings`).send({ serviceId: service.id, date: "2020-01-06", time: "10:00", ...guest });
    expect(past.status).toBe(409);
  });

  it("lets a guest look up and cancel with the code and phone only", async () => {
    await http(app).get(`/api/v1/public/bookings/${code}?phone=9999999999`).expect(404);
    const found = await http(app).get(`/api/v1/public/bookings/${code.toLowerCase()}?phone=9876543210`).expect(200);
    expect(found.body.business.name).toBe("Glow Salon");
    await http(app).post(`/api/v1/public/bookings/${code}/cancel`).send({ phone: "1111111111" }).expect(404);
    const cancelled = await http(app).post(`/api/v1/public/bookings/${code}/cancel`).send({ phone: "98765 43210" }).expect(201);
    expect(cancelled.body.status).toBe("CANCELLED");
    await http(app).post(`/api/v1/public/bookings/${code}/cancel`).send({ phone: "9876543210" }).expect(400); // already cancelled
    const again = await http(app).post(`/api/v1/public/businesses/${business.slug}/bookings`).send({ serviceId: service.id, providerId: drA.id, date: monday, time: "09:30", guestName: "Late", guestPhone: "9000000004" });
    expect(again.status).toBe(201); // the freed slot can be booked again
  });

  it("links bookings to a signed-in customer", async () => {
    const customer = await signUp(app, "Customer");
    const res = await http(app).post(`/api/v1/public/businesses/${business.slug}/bookings`).set(auth(customer.token)).send({ serviceId: service.id, date: monday, time: "11:00", providerId: drA.id, guestName: "Customer", guestPhone: "9000000005" }).expect(201);
    const mine = await http(app).get("/api/v1/me/bookings").set(auth(customer.token)).expect(200);
    expect(mine.body.map((b: { code: string }) => b.code)).toEqual([res.body.code]);
    expect((await http(app).get("/api/v1/me/bookings").set(auth(owner.token))).body).toEqual([]);
    await http(app).post(`/api/v1/me/bookings/${res.body.id}/cancel`).set(auth(owner.token)).expect(404); // not theirs
    await http(app).post(`/api/v1/me/bookings/${res.body.id}/cancel`).set(auth(customer.token)).expect(201);
  });

  it("gives staff a list, a status flow, and role limits", async () => {
    const list = await http(app).get(`/api/v1/businesses/${business.id}/bookings?from=${monday}&to=${monday}`).set(auth(owner.token)).expect(200);
    expect(list.body.length).toBeGreaterThanOrEqual(3);
    const target = list.body.find((b: { status: string }) => b.status === "CONFIRMED");
    await http(app).patch(`/api/v1/businesses/${business.id}/bookings/${target.id}/status`).set(auth(owner.token)).send({ status: "PENDING" }).expect(400);
    const done = await http(app).patch(`/api/v1/businesses/${business.id}/bookings/${target.id}/status`).set(auth(owner.token)).send({ status: "COMPLETED" }).expect(200);
    expect(done.body.status).toBe("COMPLETED");
    await http(app).patch(`/api/v1/businesses/${business.id}/bookings/${target.id}/status`).set(auth(owner.token)).send({ status: "CANCELLED" }).expect(400); // finished bookings stay finished

    // a provider only sees their own bookings
    const ashaUser = await signUp(app, "Asha Login");
    await http(app).post(`/api/v1/businesses/${business.id}/team`).set(auth(owner.token)).send({ name: "Asha Login", email: ashaUser.email, role: "PROVIDER" }).expect(201);
    await http(app).patch(`/api/v1/businesses/${business.id}/providers/${drA.id}`).set(auth(owner.token)).send({ userId: ashaUser.id }).expect(200);
    const mine = await http(app).get(`/api/v1/businesses/${business.id}/bookings`).set(auth(ashaUser.token)).expect(200);
    expect(mine.body.length).toBeGreaterThan(0);
    expect(mine.body.every((b: { provider: { name: string } }) => b.provider.name === "Asha")).toBe(true);
    await http(app).post(`/api/v1/businesses/${business.id}/services`).set(auth(ashaUser.token)).send({ name: "Nope", priceMinor: 1 }).expect(403);
    const benBooking = list.body.find((b: { provider: { name: string } | null }) => b.provider?.name === "Ben");
    await http(app).patch(`/api/v1/businesses/${business.id}/bookings/${benBooking.id}/status`).set(auth(ashaUser.token)).send({ status: "COMPLETED" }).expect(403);
  });

  it("lets reception add a walk-in even without notice, and reports stats", async () => {
    const res = await http(app).post(`/api/v1/businesses/${business.id}/bookings`).set(auth(owner.token)).send({ serviceId: service.id, providerId: drA.id, date: monday, time: "11:30", guestName: "Walk In", guestPhone: "9000000006" }).expect(201);
    expect(res.body.status).toBe("CONFIRMED");
    const stats = await http(app).get(`/api/v1/businesses/${business.id}/stats`).set(auth(owner.token)).expect(200);
    expect(stats.body).toMatchObject({ bookingsToday: expect.any(Number), activeOrders: 0, revenueTodayMinor: 0 });
    expect(stats.body.upcomingNextSevenDays + stats.body.bookingsToday).toBeGreaterThanOrEqual(0);
  });

  it("manages team members", async () => {
    const reception = await signUp(app, "Reception");
    const added = await http(app).post(`/api/v1/businesses/${business.id}/team`).set(auth(owner.token)).send({ name: "Reception", email: reception.email, role: "RECEPTION" }).expect(201);
    await http(app).post(`/api/v1/businesses/${business.id}/team`).set(auth(owner.token)).send({ name: "Reception", email: reception.email, role: "RECEPTION" }).expect(409);
    await http(app).post(`/api/v1/businesses/${business.id}/team`).set(auth(owner.token)).send({ name: "Brand New", email: "brandnew@example.com", role: "KITCHEN" }).expect(400); // needs a password
    await http(app).post(`/api/v1/businesses/${business.id}/team`).set(auth(owner.token)).send({ name: "Brand New", email: "brandnew@example.com", role: "KITCHEN", password: "password123" }).expect(201);
    await http(app).post("/api/v1/auth/login").send({ email: "brandnew@example.com", password: "password123" }).expect(201);
    await http(app).post(`/api/v1/businesses/${business.id}/team`).set(auth(owner.token)).send({ name: "Boss", email: "boss@example.com", role: "OWNER", password: "password123" }).expect(400);
    await http(app).get(`/api/v1/businesses/${business.id}/team`).set(auth(reception.token)).expect(403);
    const team = await http(app).get(`/api/v1/businesses/${business.id}/team`).set(auth(owner.token)).expect(200);
    const ownerRow = team.body.find((t: { role: string }) => t.role === "OWNER");
    await http(app).delete(`/api/v1/businesses/${business.id}/team/${ownerRow.id}`).set(auth(owner.token)).expect(400);
    await http(app).delete(`/api/v1/businesses/${business.id}/team/${added.body.id}`).set(auth(owner.token)).expect(200);
  });

  it("updates settings that change what customers see", async () => {
    await http(app).patch(`/api/v1/businesses/${business.id}`).set(auth(owner.token)).send({ autoConfirm: false, slotIntervalMinutes: 60 }).expect(200);
    const res = await http(app).get(`/api/v1/public/businesses/${business.slug}/availability?serviceId=${service.id}&date=${nextWeekday(3)}&providerId=${drB.id}`).expect(200);
    expect(res.body.slots).toHaveLength(3); // 09:00, 10:00, 11:00
    const b = await http(app).post(`/api/v1/public/businesses/${business.slug}/bookings`).send({ serviceId: service.id, providerId: drB.id, date: nextWeekday(3), time: "10:00", guestName: "Needs OK", guestPhone: "9000000007" }).expect(201);
    expect(b.body.status).toBe("PENDING");
    await http(app).patch(`/api/v1/businesses/${business.id}`).set(auth(owner.token)).send({ timezone: "Not/AZone" }).expect(400);
    await http(app).patch(`/api/v1/businesses/${business.id}`).set(auth(owner.token)).send({ autoConfirm: true, slotIntervalMinutes: 30 }).expect(200);
    expect(addDay(monday, 1)).toBeTruthy();
  });
});
