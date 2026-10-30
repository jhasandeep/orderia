import { INestApplication } from "@nestjs/common";
import { auth, createApp, http, nextWeekday, signUp } from "./helpers";

describe("QR table ordering", () => {
  let app: INestApplication;
  let owner: Awaited<ReturnType<typeof signUp>>;
  let kitchen: Awaited<ReturnType<typeof signUp>>;
  let biz: { id: string; slug: string };
  let table: { id: string; qrToken: string; label: string };
  let biryani: { id: string };
  let lassi: { id: string };
  const base = () => `/api/v1/businesses/${biz.id}/dining`;

  beforeAll(async () => {
    ({ app } = await createApp());
    owner = await signUp(app, "Restaurateur");
    biz = (await http(app).post("/api/v1/businesses").set(auth(owner.token)).send({ name: "Spice Hub", type: "RESTAURANT", city: "Mumbai" }).expect(201)).body;
    kitchen = await signUp(app, "Chef");
    await http(app).post(`/api/v1/businesses/${biz.id}/team`).set(auth(owner.token)).send({ name: "Chef", email: kitchen.email, role: "KITCHEN" }).expect(201);
  });
  afterAll(() => app.close());

  it("only allows dining on businesses that have it", async () => {
    const salon = (await http(app).post("/api/v1/businesses").set(auth(owner.token)).send({ name: "Just Salon", type: "SALON" }).expect(201)).body;
    const t = (await http(app).post(`/api/v1/businesses/${salon.id}/dining/tables`).set(auth(owner.token)).send({ label: "1" }).expect(201)).body;
    await http(app).get(`/api/v1/public/tables/${t.qrToken}`).expect(400);
    // the owner can switch the module on
    await http(app).patch(`/api/v1/businesses/${salon.id}`).set(auth(owner.token)).send({ modules: ["APPOINTMENTS", "DINING"] }).expect(200);
    await http(app).get(`/api/v1/public/tables/${t.qrToken}`).expect(200);
  });

  it("creates tables with unique labels and QR links", async () => {
    table = (await http(app).post(`${base()}/tables`).set(auth(owner.token)).send({ label: "T1", seats: 4 }).expect(201)).body;
    expect(table.qrToken.length).toBeGreaterThan(15);
    await http(app).post(`${base()}/tables`).set(auth(owner.token)).send({ label: "T1" }).expect(409);
    await http(app).post(`${base()}/tables`).set(auth(owner.token)).send({ label: "T2", seats: 2 }).expect(201);
    const qr = await http(app).get(`${base()}/tables/${table.id}/qr`).set(auth(owner.token)).expect(200);
    expect(qr.body.url).toBe(`http://localhost:3000/t/${table.qrToken}`);
    expect(qr.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    await http(app).get(`${base()}/tables`).set(auth(kitchen.token)).expect(403); // the kitchen has no need for tables
  });

  it("builds a menu", async () => {
    const mains = (await http(app).post(`${base()}/categories`).set(auth(owner.token)).send({ name: "Mains", sort: 1 }).expect(201)).body;
    biryani = (await http(app).post(`${base()}/items`).set(auth(owner.token)).send({ name: "Chicken Biryani", priceMinor: 25000, categoryId: mains.id, veg: false }).expect(201)).body;
    lassi = (await http(app).post(`${base()}/items`).set(auth(owner.token)).send({ name: "Sweet Lassi", priceMinor: 8000 }).expect(201)).body;
    await http(app).post(`${base()}/items`).set(auth(owner.token)).send({ name: "Bad", priceMinor: 100, categoryId: "nope" }).expect(400);
    await http(app).post(`${base()}/items`).set(auth(kitchen.token)).send({ name: "Not allowed", priceMinor: 100 }).expect(403);
  });

  it("shows the menu when a table's QR code is scanned", async () => {
    const page = await http(app).get(`/api/v1/public/tables/${table.qrToken}`).expect(200);
    expect(page.body.table.label).toBe("T1");
    expect(page.body.business.name).toBe("Spice Hub");
    expect(page.body.menu.items.map((i: { name: string }) => i.name).sort()).toEqual(["Chicken Biryani", "Sweet Lassi"]);
    expect(page.body.payment.methods).toEqual(["CASH"]);
    await http(app).get("/api/v1/public/tables/not-a-real-token").expect(404);
  });

  let order: { id: string; code: string };

  it("places an order priced by the server, not by the guest", async () => {
    await http(app).post(`/api/v1/public/tables/${table.qrToken}/orders`).send({ items: [{ menuItemId: biryani.id, quantity: 1, priceMinor: 1 }] }).expect(400); // client prices are refused
    await http(app).post(`/api/v1/public/tables/${table.qrToken}/orders`).send({ items: [] }).expect(400);
    await http(app).post(`/api/v1/public/tables/${table.qrToken}/orders`).send({ items: [{ menuItemId: "nope", quantity: 1 }] }).expect(400);
    await http(app).post(`/api/v1/public/tables/${table.qrToken}/orders`).send({ items: [{ menuItemId: biryani.id, quantity: 0 }] }).expect(400);
    const res = await http(app).post(`/api/v1/public/tables/${table.qrToken}/orders`).send({ guestName: "Asha", items: [{ menuItemId: biryani.id, quantity: 2, note: "less spicy" }, { menuItemId: lassi.id, quantity: 1 }] }).expect(201);
    order = res.body;
    expect(res.body).toMatchObject({ status: "PLACED", totalMinor: 58000, paymentStatus: "UNPAID" });
    expect(res.body.table.label).toBe("T1");
    expect(res.body.items.find((i: { name: string }) => i.name === "Chicken Biryani")).toMatchObject({ quantity: 2, priceMinor: 25000, note: "less spicy" });
  });

  it("keeps the old price on an order after the menu price changes", async () => {
    await http(app).patch(`${base()}/items/${biryani.id}`).set(auth(owner.token)).send({ priceMinor: 30000 }).expect(200);
    const again = await http(app).get(`/api/v1/public/orders/${order.code}`).expect(200);
    expect(again.body.totalMinor).toBe(58000);
    await http(app).patch(`${base()}/items/${biryani.id}`).set(auth(owner.token)).send({ priceMinor: 25000 }).expect(200);
  });

  it("refuses items that are out of stock, and lets the kitchen switch them off", async () => {
    await http(app).patch(`${base()}/items/${lassi.id}`).set(auth(kitchen.token)).send({ available: false }).expect(200);
    await http(app).post(`/api/v1/public/tables/${table.qrToken}/orders`).send({ items: [{ menuItemId: lassi.id, quantity: 1 }] }).expect(409);
    const page = await http(app).get(`/api/v1/public/tables/${table.qrToken}`);
    expect(page.body.menu.items.map((i: { name: string }) => i.name)).toEqual(["Chicken Biryani"]);
    await http(app).patch(`${base()}/items/${lassi.id}`).set(auth(kitchen.token)).send({ priceMinor: 1 }).expect(200); // the kitchen may edit items...
    await http(app).patch(`${base()}/items/${lassi.id}`).set(auth(kitchen.token)).send({ available: true, priceMinor: 8000 }).expect(200);
  });

  it("runs the kitchen board through the order flow", async () => {
    const active = await http(app).get(`${base()}/orders`).set(auth(kitchen.token)).expect(200);
    expect(active.body.map((o: { code: string }) => o.code)).toContain(order.code);
    const status = (s: string) => http(app).patch(`${base()}/orders/${order.id}/status`).set(auth(kitchen.token)).send({ status: s });
    await status("READY").expect(400); // cannot skip a step
    expect((await status("PREPARING").expect(200)).body.status).toBe("PREPARING");
    expect((await status("READY").expect(200)).body.status).toBe("READY");
    expect((await http(app).get(`/api/v1/public/orders/${order.code}`)).body.status).toBe("READY"); // the guest sees it
    expect((await status("SERVED").expect(200)).body.status).toBe("SERVED");
    await status("CANCELLED").expect(400);
    const stillActive = await http(app).get(`${base()}/orders`).set(auth(kitchen.token));
    expect(stillActive.body.map((o: { code: string }) => o.code)).not.toContain(order.code);
    const all = await http(app).get(`${base()}/orders?filter=all`).set(auth(kitchen.token));
    expect(all.body.map((o: { code: string }) => o.code)).toContain(order.code);
  });

  it("takes payment for an order by UPI QR", async () => {
    await http(app).put(`/api/v1/businesses/${biz.id}/payment-settings`).set(auth(owner.token)).send({ enabledMethods: ["CASH", "UPI_QR"], upiId: "spicehub@okbank", upiName: "Spice Hub" }).expect(200);
    const start = await http(app).post(`/api/v1/public/orders/${order.code}/payments`).send({ method: "UPI_QR" }).expect(201);
    expect(start.body.payment.amountMinor).toBe(58000);
    expect(start.body.upi.link).toContain("am=580.00");
    await http(app).post(`/api/v1/public/payments/${start.body.payment.id}/upi-reference`).send({ reference: "UPIREF987654" }).expect(201);
    await http(app).post(`/api/v1/businesses/${biz.id}/payments/${start.body.payment.id}/confirm`).set(auth(owner.token)).expect(201);
    const after = await http(app).get(`/api/v1/public/orders/${order.code}`).expect(200);
    expect(after.body).toMatchObject({ paymentStatus: "PAID", paidMinor: 58000 });
    expect(after.body.payments[0]).toMatchObject({ method: "UPI_QR", status: "PAID" });
    expect(after.body.paymentMethods).toEqual(["CASH", "UPI_QR"]);
    expect(after.body.business.name).toBe("Spice Hub");
    await http(app).post(`/api/v1/public/orders/${order.code}/payments`).send({ method: "CASH" }).expect(409);
    await http(app).post(`/api/v1/public/orders/NOPE00/payments`).send({ method: "CASH" }).expect(404);
    await http(app).get(`/api/v1/businesses/${biz.id}/payments`).set(auth(kitchen.token)).expect(403); // the kitchen cannot see money
  });

  it("can cancel an order before it is served", async () => {
    const o = (await http(app).post(`/api/v1/public/tables/${table.qrToken}/orders`).send({ items: [{ menuItemId: biryani.id, quantity: 1 }] }).expect(201)).body;
    await http(app).patch(`${base()}/orders/${o.id}/status`).set(auth(kitchen.token)).send({ status: "CANCELLED" }).expect(200);
    await http(app).post(`/api/v1/public/orders/${o.code}/payments`).send({ method: "CASH" }).expect(400);
  });

  it("stops an old QR code from working after it is rotated", async () => {
    const old = table.qrToken;
    const rotated = (await http(app).post(`${base()}/tables/${table.id}/rotate-qr`).set(auth(owner.token)).expect(201)).body;
    expect(rotated.qrToken).not.toBe(old);
    await http(app).get(`/api/v1/public/tables/${old}`).expect(404);
    await http(app).get(`/api/v1/public/tables/${rotated.qrToken}`).expect(200);
    await http(app).patch(`${base()}/tables/${table.id}`).set(auth(owner.token)).send({ active: false }).expect(200);
    await http(app).get(`/api/v1/public/tables/${rotated.qrToken}`).expect(404); // a disabled table cannot order
  });

  it("reserves the smallest free table that fits and then runs out", async () => {
    const day = nextWeekday(6, 4);
    const reserve = (name: string, party: number, time = "20:00") => http(app).post(`/api/v1/public/businesses/${biz.slug}/table-reservations`).send({ guestName: name, guestPhone: "9900011122", partySize: party, date: day, time });
    // T1 is switched off above, so only T2 (2 seats) is left; add a bigger table
    await http(app).post(`${base()}/tables`).set(auth(owner.token)).send({ label: "T3", seats: 6 }).expect(201);
    const two = await reserve("Pair", 2).expect(201);
    expect(two.body.table.label).toBe("T2"); // the snuggest fit
    const another = await reserve("Pair B", 2).expect(201);
    expect(another.body.table.label).toBe("T3"); // T2 is taken at that time
    await reserve("Pair C", 2).expect(409); // nothing left
    await reserve("Pair D", 2, "22:00").expect(201); // later that night is free again
    await reserve("Big", 20).expect(409);
    await http(app).post(`/api/v1/public/businesses/${biz.slug}/table-reservations`).send({ guestName: "Past", guestPhone: "9900011122", partySize: 2, date: "2020-01-01", time: "20:00" }).expect(400);
    const list = await http(app).get(`${base()}/reservations?date=${day}`).set(auth(owner.token)).expect(200);
    expect(list.body).toHaveLength(3);
    const first = list.body[0];
    await http(app).patch(`${base()}/reservations/${first.id}/status`).set(auth(owner.token)).send({ status: "CANCELLED" }).expect(200);
    await reserve("After cancel", 2).expect(201); // cancelling frees the table
  });
});
