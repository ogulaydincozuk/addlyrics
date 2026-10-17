import { describe, expect, it } from "vitest";
import { pickActiveAnnouncement, type AnnouncementLike } from "@/lib/announcements";
import { aggregateTrialStage, proposeTrialApproaches, trialConversionPlan } from "@/lib/trial";
import { buildPreviewPlan } from "@/server/video/ffmpeg";

const now = new Date("2026-10-20T12:00:00Z");
const ann = (over: Partial<AnnouncementLike>): AnnouncementLike => ({
  id: Math.random().toString(36),
  status: "PUBLISHED",
  startsAt: null,
  endsAt: null,
  priority: 0,
  publishedAt: new Date("2026-10-19T10:00:00Z"),
  updatedAt: new Date("2026-10-19T10:00:00Z"),
  ...over,
});

describe("duyuru seçimi", () => {
  it("aktif duyuru yoksa hiçbir şey gösterilmez", () => {
    expect(pickActiveAnnouncement([], now)).toBeNull();
    expect(pickActiveAnnouncement([ann({ status: "DRAFT" }), ann({ status: "UNPUBLISHED" })], now)).toBeNull();
    expect(pickActiveAnnouncement([ann({ startsAt: new Date("2026-10-21T00:00:00Z") })], now)).toBeNull();
    expect(pickActiveAnnouncement([ann({ endsAt: new Date("2026-10-20T11:00:00Z") })], now)).toBeNull();
  });

  it("yayındaki duyurulardan önceliği yüksek, sonra en güncel olan gösterilir", () => {
    const old = ann({ id: "eski", publishedAt: new Date("2026-10-01T00:00:00Z") });
    const fresh = ann({ id: "yeni", publishedAt: new Date("2026-10-19T00:00:00Z") });
    const pinned = ann({ id: "oncelikli", priority: 5, publishedAt: new Date("2026-09-01T00:00:00Z") });
    expect(pickActiveAnnouncement([old, fresh], now)?.id).toBe("yeni");
    expect(pickActiveAnnouncement([old, fresh, pinned], now)?.id).toBe("oncelikli");
  });
});

describe("denemeden satın alma video hesabı", () => {
  it("30 videoluk pakette 3 deneme + 27 yeni = 30", () => {
    expect(trialConversionPlan({ videoCount: 30, bonusVideoCount: 0, durationMonths: 1, countsTowardPackage: true })).toMatchObject({
      orderVideoCount: 30,
      newVideos: 27,
      trialVideos: 3,
      entitlementTotal: 30,
    });
  });

  it("3 aylık pakette ilk teslim 30 (3 deneme + 27), toplam 105", () => {
    expect(trialConversionPlan({ videoCount: 90, bonusVideoCount: 15, durationMonths: 3, countsTowardPackage: true })).toMatchObject({
      firstBatch: 30,
      orderVideoCount: 30,
      newVideos: 27,
      entitlementTotal: 105,
    });
  });

  it("paket kuralı 'dahil değil' ise deneme videoları pakete eklenir", () => {
    expect(trialConversionPlan({ videoCount: 30, bonusVideoCount: 0, durationMonths: 1, countsTowardPackage: false })).toMatchObject({
      orderVideoCount: 33,
      newVideos: 30,
      entitlementTotal: 33,
    });
  });
});

describe("deneme aşamaları", () => {
  it("videolardan başvuru aşaması hesaplanır", () => {
    expect(aggregateTrialStage(["QUEUED", "QUEUED", "QUEUED"])).toBe("QUEUED");
    expect(aggregateTrialStage(["IN_PRODUCTION", "QUEUED", "QUEUED"])).toBe("IN_PRODUCTION");
    expect(aggregateTrialStage(["PREVIEW_READY", "EDITOR_REVIEW", "QUEUED"])).toBe("IN_PRODUCTION");
    expect(aggregateTrialStage(["PREVIEW_READY", "PREVIEW_READY", "PREVIEW_READY"])).toBe("PREVIEW_READY");
    expect(aggregateTrialStage(["PREVIEW_READY", "FAILED", "PREVIEW_READY"])).toBe("FAILED");
  });

  it("üç farklı yaklaşım önerilir; klip varsa üçüncüsü klip üzerine sözler", () => {
    const withClip = proposeTrialApproaches({ hasMusicVideo: true });
    expect(withClip.map((a) => a.style)).toEqual(["FILM_EDIT", "MINIMAL", "MUSIC_VIDEO"]);
    const preferred = proposeTrialApproaches({ hasMusicVideo: false, preferred: "MINIMAL" });
    expect(preferred[0]!.style).toBe("MINIMAL");
    expect(new Set(preferred.map((a) => a.style)).size).toBe(3);
  });
});

describe("ön izleme kesiti (ffmpeg planı)", () => {
  const base = { source: "in.mp4", output: "out.mp4", startSeconds: 10, durationSeconds: 20, watermarkPath: "wm.png", watermark: true, blur: false };

  it("filtreler destekleniyorsa logo filigranı eklenir ve kesit kısaltılır", () => {
    const plan = buildPreviewPlan({ ...base, filters: new Set(["overlay", "scale2ref", "scale", "boxblur"]) });
    expect(plan.watermarked).toBe(true);
    expect(plan.args.join(" ")).toContain("overlay");
    expect(plan.args).toEqual(expect.arrayContaining(["-ss", "10", "-t", "20"]));
  });

  it("filtre yoksa filigran eklenmiş gibi gösterilmez", () => {
    const plan = buildPreviewPlan({ ...base, blur: true, filters: new Set(["scale"]) });
    expect(plan.watermarked).toBe(false);
    expect(plan.blurred).toBe(false);
    expect(plan.args.join(" ")).not.toContain("overlay");
  });
});
