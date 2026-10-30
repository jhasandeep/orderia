import { addDays, localDate, minutesOf, timeOf, weekdayOf, zonedToUtc } from "./tz";

describe("time zone helpers", () => {
  it("turns local times into the right instants", () => {
    expect(zonedToUtc("2026-11-02", "09:00", "Asia/Kolkata").toISOString()).toBe("2026-11-02T03:30:00.000Z");
    expect(zonedToUtc("2026-11-02", "00:00", "UTC").toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(zonedToUtc("2026-07-01", "12:00", "America/New_York").toISOString()).toBe("2026-07-01T16:00:00.000Z"); // daylight time
    expect(zonedToUtc("2026-12-01", "12:00", "America/New_York").toISOString()).toBe("2026-12-01T17:00:00.000Z"); // standard time
  });

  it("finds the local calendar date of an instant", () => {
    expect(localDate(new Date("2026-11-02T20:00:00Z"), "Asia/Kolkata")).toBe("2026-11-03"); // already tomorrow in India
    expect(localDate(new Date("2026-11-02T20:00:00Z"), "UTC")).toBe("2026-11-02");
  });

  it("does calendar maths", () => {
    expect(weekdayOf("2026-11-02")).toBe(1); // Monday
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(minutesOf("09:30")).toBe(570);
    expect(timeOf(570)).toBe("09:30");
  });
});
