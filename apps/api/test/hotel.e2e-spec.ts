import { INestApplication } from "@nestjs/common";
import { addDay, auth, createApp, http, nextWeekday, signUp } from "./helpers";

describe("hotel stays", () => {
  let app: INestApplication;
  let owner: Awaited<ReturnType<typeof signUp>>;
  let hotel: { id: string; slug: string };
  let room: { id: string };
  const checkIn = nextWeekday(5, 10);

  beforeAll(async () => {
    ({ app } = await createApp());
    owner = await signUp(app, "Hotelier");
    hotel = (await http(app).post("/api/v1/businesses").set(auth(owner.token)).send({ name: "Sea View Hotel", type: "HOTEL", city: "Goa" }).expect(201)).body;
    expect(hotel).toBeTruthy();
    room = (await http(app).post(`/api/v1/businesses/${hotel.id}/services`).set(auth(owner.token)).send({ name: "Deluxe Room", mode: "STAY", priceMinor: 450000, capacity: 2 }).expect(201)).body;
  });
  afterAll(() => app.close());

  const book = (rooms: number, from: string, to: string, name = "Guest") =>
    http(app).post(`/api/v1/public/businesses/${hotel.slug}/bookings`).send({ serviceId: room.id, checkIn: from, checkOut: to, rooms, guests: 2, guestName: name, guestPhone: "9811122233" });

  it("enables appointments and dining for hotels by default", async () => {
    const page = await http(app).get(`/api/v1/public/businesses/${hotel.slug}`).expect(200);
    expect(page.body.business.modules).toEqual(["APPOINTMENTS", "DINING"]);
    expect(page.body.business.checkInTime).toBe("14:00");
  });

  it("quotes nights and price", async () => {
    const res = await http(app).get(`/api/v1/public/businesses/${hotel.slug}/rooms?serviceId=${room.id}&checkIn=${checkIn}&checkOut=${addDay(checkIn, 3)}`).expect(200);
    expect(res.body).toMatchObject({ nights: 3, available: 2, pricePerNightMinor: 450000, totalMinor: 1350000 });
    await http(app).get(`/api/v1/public/businesses/${hotel.slug}/rooms?serviceId=${room.id}&checkIn=${checkIn}&checkOut=${checkIn}`).expect(400);
    await http(app).get(`/api/v1/public/businesses/${hotel.slug}/rooms?serviceId=${room.id}&checkIn=${checkIn}&checkOut=${addDay(checkIn, 90)}`).expect(400);
  });

  it("charges per night and per room, and counts rooms down", async () => {
    const first = await book(1, checkIn, addDay(checkIn, 2), "First").expect(201);
    expect(first.body.totalMinor).toBe(900000);
    expect(first.body.quantity).toBe(1);
    const left = await http(app).get(`/api/v1/public/businesses/${hotel.slug}/rooms?serviceId=${room.id}&checkIn=${checkIn}&checkOut=${addDay(checkIn, 2)}`);
    expect(left.body.available).toBe(1);
    await book(2, checkIn, addDay(checkIn, 2), "TooMany").expect(409); // only one room left
    const second = await book(1, checkIn, addDay(checkIn, 2), "Second").expect(201);
    await book(1, checkIn, addDay(checkIn, 2), "Third").expect(409); // sold out
    expect(second.body.status).toBe("CONFIRMED");
  });

  it("allows back-to-back stays: a guest can arrive the day another leaves", async () => {
    await book(2, addDay(checkIn, 2), addDay(checkIn, 4), "Next").expect(201);
  });

  it("blocks a long stay that touches a sold-out night", async () => {
    await book(1, addDay(checkIn, 1), addDay(checkIn, 3), "Overlap").expect(409);
  });

  it("frees the rooms again when a booking is cancelled", async () => {
    const b = await book(1, addDay(checkIn, 10), addDay(checkIn, 11), "Short").expect(201);
    await book(2, addDay(checkIn, 10), addDay(checkIn, 11), "Both").expect(409);
    await http(app).post(`/api/v1/public/bookings/${b.body.code}/cancel`).send({ phone: "9811122233" }).expect(201);
    await book(2, addDay(checkIn, 10), addDay(checkIn, 11), "Both").expect(201);
  });

  it("rejects dates in the past and slot bookings on a stay", async () => {
    await book(1, "2020-01-01", "2020-01-03", "Past").expect(400);
    await http(app).post(`/api/v1/public/businesses/${hotel.slug}/bookings`).send({ serviceId: room.id, date: checkIn, time: "10:00", guestName: "Wrong", guestPhone: "9811122233" }).expect(400);
    await http(app).get(`/api/v1/public/businesses/${hotel.slug}/availability?serviceId=${room.id}&date=${checkIn}`).expect(400);
  });
});
