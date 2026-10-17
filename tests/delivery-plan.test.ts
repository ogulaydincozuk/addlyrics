import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  batchDateForIndex,
  deliveryDates,
  deliverySchedule,
  describeDeliveryPlan,
  monthlyAllocation,
} from "@/lib/delivery-plan";

const day = (d: Date) => d.toISOString().slice(0, 10);

describe("aylık teslim planı", () => {
  it("paketleri aylara böler; bonus son aya eklenir", () => {
    expect(monthlyAllocation(30, 0, 1)).toEqual([30]);
    expect(monthlyAllocation(60, 0, 2)).toEqual([30, 30]);
    expect(monthlyAllocation(90, 15, 3)).toEqual([30, 30, 45]);
    expect(monthlyAllocation(10, 0, 3)).toEqual([3, 3, 4]);
  });

  it("ayın 16'sı ve sonrası: tüm teslimler izleyen ayların 1'inde (Türkiye saati)", () => {
    expect(deliveryDates(new Date("2026-10-17T10:00:00+03:00"), 3).map(day)).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
    expect(deliveryDates(new Date("2026-10-16T00:10:00+03:00"), 1).map(day)).toEqual(["2026-11-01"]);
    // Ayın son günü gece yarısına yakın ödeme (UTC'de hâlâ önceki gün) Türkiye ayına göre hesaplanır
    expect(day(deliveryDates(new Date("2026-10-31T23:30:00+03:00"), 1)[0]!)).toBe("2026-11-01");
  });

  it("ayın 1–15'i: ilk teslim 5 iş günü içinde, sonrakiler izleyen ayların 1'inde", () => {
    // 9 Ekim 2026 Cuma → 16 Ekim Cuma; ardından 1 Kasım, 1 Aralık
    expect(deliveryDates(new Date("2026-10-09T14:00:00+03:00"), 3).map(day)).toEqual(["2026-10-16", "2026-11-01", "2026-12-01"]);
    // 15 Ekim Perşembe → hafta sonu atlanır → 22 Ekim Perşembe
    expect(day(deliveryDates(new Date("2026-10-15T09:00:00+03:00"), 1)[0]!)).toBe("2026-10-22");
    // 1 Kasım 2026 Pazar 00:30 (UTC'de hâlâ 31 Ekim) → Türkiye'ye göre ayın 1'i → 6 Kasım Cuma
    expect(deliveryDates(new Date("2026-11-01T00:30:00+03:00"), 2).map(day)).toEqual(["2026-11-06", "2026-12-01"]);
  });

  it("iş günü hesabı hafta sonlarını ve sabit resmî tatilleri atlar", () => {
    // 20 Nisan 2026 Pazartesi; 23 Nisan resmî tatil → 21, 22, 24, 27, 28
    expect(day(addBusinessDays(new Date("2026-04-20T12:00:00+03:00"), 5))).toBe("2026-04-28");
  });

  it("videonun sırasına göre teslim tarihini bulur", () => {
    const schedule = deliverySchedule(new Date("2026-10-09T14:00:00+03:00"), 90, 15, 3);
    expect(schedule.map((b) => [b.videos, b.fromIndex, b.toIndex])).toEqual([
      [30, 0, 29],
      [30, 30, 59],
      [45, 60, 104],
    ]);
    expect(day(batchDateForIndex(schedule, 0)!)).toBe("2026-10-16");
    expect(day(batchDateForIndex(schedule, 30)!)).toBe("2026-11-01");
    expect(day(batchDateForIndex(schedule, 104)!)).toBe("2026-12-01");
  });

  it("okunur açıklama üretir", () => {
    expect(describeDeliveryPlan(30, 0, 1)).toBe(
      "30 video tek seferde teslim edilir. Ayın 1–15'i arasındaki alımlarda ilk teslim 5 iş günü içinde, 16'sından sonraki alımlarda izleyen ayın 1'inde yapılır.",
    );
    expect(describeDeliveryPlan(90, 15, 3)).toBe(
      "1. teslim 30, 2. teslim 30, 3. teslim 45 video (15 bonus dahil). Ayın 1–15'i arasındaki alımlarda ilk teslim 5 iş günü içinde, 16'sından sonraki alımlarda izleyen ayın 1'inde yapılır. Sonraki teslimler her ayın 1'inde.",
    );
  });
});
