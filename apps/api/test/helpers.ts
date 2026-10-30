import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createHmac } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { RazorpayGateway } from "../src/payments/razorpay.gateway";
import { configureApp } from "../src/setup";

/** A fake Razorpay that never touches the network. */
export class FakeRazorpay extends RazorpayGateway {
  created: { keyId: string; amountMinor: number; receipt: string }[] = [];
  async createOrder(keyId: string, _secret: string, o: { amountMinor: number; currency: string; receipt: string }) {
    this.created.push({ keyId, amountMinor: o.amountMinor, receipt: o.receipt });
    return { id: `order_test_${this.created.length}`, amount: o.amountMinor, currency: o.currency };
  }
}

export async function createApp() {
  const razorpay = new FakeRazorpay();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(RazorpayGateway).useValue(razorpay).compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app);
  await app.init();
  return { app, razorpay };
}

let counter = 0;
export async function signUp(app: INestApplication, name = "User") {
  counter++;
  const email = `${name.toLowerCase().replace(/\W/g, "")}${counter}@example.com`;
  const res = await request(app.getHttpServer()).post("/api/v1/auth/register").send({ name, email, password: "password123", phone: `98765${String(10000 + counter)}` }).expect(201);
  return { token: res.body.token as string, id: res.body.user.id as string, email };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** The next date (YYYY-MM-DD) at least `minDays` ahead that falls on the given weekday (0 = Sunday). */
export function nextWeekday(weekday: number, minDays = 3): string {
  const d = new Date(Date.now() + minDays * 86_400_000);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const addDay = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export const hmac = (data: string | Buffer, secret: string) => createHmac("sha256", secret).update(data).digest("hex");

export const http = (app: INestApplication) => request(app.getHttpServer());
