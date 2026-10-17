import "server-only";
import { Prisma, type OrderStatus, type Payment, type PaymentProvider } from "@prisma/client";
import { CUSTOMER_FILE_KINDS } from "@/lib/enums";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { missingRequiredItems } from "@/lib/order-requirements";
import { addBusinessDays, batchDateForIndex, deliverySchedule } from "@/lib/delivery-plan";
import { addMonths, snapshotTotalVideos, type PackageSnapshot } from "@/lib/packages";
import { codeAvailability } from "@/lib/referral";
import { TRIAL_VIDEO_COUNT } from "@/lib/trial";
import { randomToken } from "../crypto";
import { db } from "../db";
import { DomainError, isUniqueViolation } from "../domain/errors";
import { commissionSettings, handleCommissionRefund, recordCommissionForPayment } from "../domain/referrals";
import { readSystemSetting } from "../system-settings";
import { appUrl, samplePackagesAllowed } from "../env";
import { notifyAdmins, notifyUser } from "../notify";
import { activeProviderId } from "./config";
import { IyzicoGateway } from "./iyzico";
import { MockGateway } from "./mock";
import { ShopifyGateway } from "./shopify";
import type { PaymentGateway, VerifiedResult } from "./types";

export function gatewayFor(provider: PaymentProvider): PaymentGateway {
  switch (provider) {
    case "IYZICO":
      return new IyzicoGateway();
    case "SHOPIFY":
      return new ShopifyGateway();
    case "MOCK":
      return new MockGateway();
  }
}

export type BillingInput = {
  billingName: string;
  billingPhone: string;
  billingCity: string;
  billingAddress: string;
  billingIdentityNumber?: string;
};

// ───────────────────────────── Ödeme başlatma ─────────────────────────────

/**
 * Ödemeyi başlatır ve müşterinin yönlendirileceği ödeme sayfası adresini döndürür.
 * Tutar her zaman siparişin sunucudaki anlık görüntüsünden alınır.
 */
export async function startPayment(orderNumber: string, userId: string, billing: BillingInput, ip: string) {
  const provider = activeProviderId();
  if (!provider) throw new DomainError("Online ödeme henüz aktif değil.", "PAYMENTS_UNAVAILABLE");

  const order = await db.order.findFirst({
    where: { number: orderNumber, userId },
    include: { user: true, package: { include: { channelListings: true } } },
  });
  if (!order) throw new DomainError("Sipariş bulunamadı.");
  if (order.kind !== "PURCHASE" || order.status !== "PAYMENT_PENDING") {
    throw new DomainError("Bu sipariş için ödeme beklenmiyor.", "NOT_PAYABLE");
  }
  const snapshot = order.packageSnapshot as unknown as PackageSnapshot;
  if (snapshot.isSample && !samplePackagesAllowed()) {
    throw new DomainError("Örnek paketler için ödeme alınamaz.", "NOT_PAYABLE");
  }
  if (order.priceKurus <= 0) throw new DomainError("Sipariş tutarı geçersiz.", "NOT_PAYABLE");
  // Uygulanmış referans kodu ödeme anında yeniden doğrulanır (süresi dolmuş/pasif koda indirim verilmez)
  if (order.referralCodeId) {
    const code = await db.referralCode.findUnique({ where: { id: order.referralCodeId }, include: { partner: { select: { active: true } } } });
    const availability = code ? codeAvailability({ ...code, partnerActive: code.partner.active }) : { ok: false as const, reason: "Kod bulunamadı." };
    if (!availability.ok) {
      await db.order.update({
        where: { id: order.id },
        data: { priceKurus: order.listPriceKurus ?? order.priceKurus + order.discountKurus, discountKurus: 0, referralCodeId: null, partnerId: null },
      });
      throw new DomainError(`İndirim kodu artık geçerli değil (${availability.reason}) Tutar güncellendi; lütfen kontrol edip tekrar dene.`, "CODE_UNAVAILABLE");
    }
  }

  let shopifyVariantId: string | null = null;
  if (provider === "SHOPIFY") {
    const listing = order.package.channelListings.find((l) => l.channel === "SHOPIFY");
    if (!listing) throw new DomainError("Bu paket henüz Shopify ile eşlenmedi.", "NOT_PAYABLE");
    shopifyVariantId = listing.externalVariantId;
  }

  // Önceki bekleyen ödeme denemeleri geçersiz sayılır (sonradan başarılı dönerlerse yine işlenir).
  await db.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });

  await db.order.update({
    where: { id: order.id },
    data: {
      billingName: billing.billingName,
      billingPhone: billing.billingPhone,
      billingCity: billing.billingCity,
      billingAddress: billing.billingAddress,
      billingIdentityNumber: billing.billingIdentityNumber ?? null,
      distanceSalesAcceptedAt: new Date(),
    },
  });

  const payment = await db.payment.create({
    data: {
      orderId: order.id,
      userId,
      provider,
      amountKurus: order.priceKurus,
      currency: order.currency,
      conversationId: `alp_${randomToken(12)}`,
    },
  });

  const gateway = gatewayFor(provider);
  try {
    const init = await gateway.initialize({
      payment,
      order: { id: order.id, number: order.number, packageId: order.packageId, packageName: snapshot.name },
      buyer: {
        id: userId,
        fullName: billing.billingName,
        email: order.user.email,
        phone: billing.billingPhone,
        city: billing.billingCity,
        address: billing.billingAddress,
        identityNumber: billing.billingIdentityNumber ?? null,
        ip,
      },
      callbackUrl: appUrl(`/api/payments/${provider.toLowerCase()}/callback`),
      shopifyVariantId,
    });
    await db.payment.update({ where: { id: payment.id }, data: { providerToken: init.token, checkoutUrl: init.checkoutUrl } });
    return { paymentId: payment.id, checkoutUrl: init.checkoutUrl };
  } catch (err) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", failureReason: (err as Error).message.slice(0, 500) },
    });
    throw new DomainError("Ödeme sayfası açılamadı. Lütfen biraz sonra tekrar dene.", "GATEWAY");
  }
}

// ───────────────────────────── Sonuç işleme ─────────────────────────────

/** Sağlayıcı dönüşü (callback) veya webhook sonrası: token ile sağlayıcıdan doğrular ve işler. */
export async function confirmByToken(provider: PaymentProvider, token: string) {
  const payment = await db.payment.findUnique({ where: { providerToken: token }, include: { order: true } });
  if (!payment || payment.provider !== provider) return null;
  const result = await gatewayFor(provider).retrieve(token, payment);
  await applyVerifiedResult(payment, result);
  return { orderNumber: payment.order.number, paymentId: payment.id };
}

/**
 * Doğrulanmış sonucu kendi kayıtlarımızla karşılaştırır. Tutar, para birimi veya referans
 * uyuşmazsa paket hakkı tanımlanmaz ve ekibe uyarı gider.
 */
export async function applyVerifiedResult(payment: Payment & { order: { number: string } }, result: VerifiedResult) {
  if (result.status === "PENDING") {
    if (result.failureReason) {
      await db.payment.update({ where: { id: payment.id }, data: { rawResult: result.raw as Prisma.InputJsonValue } });
    }
    return "PENDING" as const;
  }

  if (result.status === "FAILED") {
    await markPaymentFailed(payment.id, result.failureReason ?? "Ödeme başarısız oldu.", result.raw);
    return "FAILED" as const;
  }

  const mismatches: string[] = [];
  if (result.conversationId && result.conversationId !== payment.conversationId) mismatches.push("conversationId");
  if (result.basketReference && result.basketReference !== payment.order.number) mismatches.push("sipariş numarası");
  if (result.amountKurus == null || result.amountKurus !== payment.amountKurus) mismatches.push("tutar");
  if (!result.currency || result.currency !== payment.currency) mismatches.push("para birimi");

  if (mismatches.length) {
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failureReason: `Doğrulama uyuşmazlığı: ${mismatches.join(", ")}`,
        rawResult: result.raw as Prisma.InputJsonValue,
        providerPaymentId: result.providerPaymentId ?? undefined,
      },
    });
    await notifyAdmins({
      title: `Ödeme doğrulama uyuşmazlığı: ${payment.order.number}`,
      body: `Sağlayıcı başarılı dedi ancak şu alanlar eşleşmedi: ${mismatches.join(", ")}. Paket hakkı tanımlanmadı; ödemeyi sağlayıcı panelinden kontrol edin.`,
      orderId: payment.orderId,
      href: `/admin/siparisler/${payment.order.number}`,
    });
    return "FAILED" as const;
  }

  await finalizeSuccessfulPayment(payment.id, result);
  return "SUCCEEDED" as const;
}

/**
 * Başarılı ödemeyi idempotent biçimde işler: aynı bildirim birden çok kez gelse de
 * paket hakkı yalnızca bir kez tanımlanır.
 */
export async function finalizeSuccessfulPayment(paymentId: string, result: VerifiedResult) {
  const now = new Date();
  let outcome: "granted" | "already" | "duplicate" = "already";
  // Ayarlar işlem dışında okunur (komisyon bekleme süresi, deneme dönüşüm iş günü)
  const [commerce, trialSettings] = await Promise.all([commissionSettings(), readSystemSetting("system.trial")]);
  let conversion: { trialNumber: string; newVideos: number; newDue: Date | null } | null = null;

  try {
    outcome = await db.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: paymentId, status: { in: ["PENDING", "FAILED", "CANCELLED"] } },
        data: {
          status: "SUCCEEDED",
          paidAt: now,
          failureReason: null,
          providerPaymentId: result.providerPaymentId ?? undefined,
          providerReference: result.providerReference ?? undefined,
          rawResult: result.raw as Prisma.InputJsonValue,
        },
      });
      if (claimed.count === 0) return "already" as const; // zaten işlendi (veya iade edildi)

      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      const order = await tx.order.findUniqueOrThrow({
        where: { id: payment.orderId },
        include: {
          sourceOfEntitlement: { select: { id: true } },
          song: { select: { lyrics: true } },
          files: { where: { status: "UPLOADED" }, select: { kind: true } },
        },
      });
      if (order.sourceOfEntitlement) return "duplicate" as const;

      const snapshot = order.packageSnapshot as unknown as PackageSnapshot;

      // Ücretsiz denemeden satın alma: deneme yalnızca bir siparişe dönüştürülebilir (convertedOrderId benzersiz)
      let trial: { id: string; number: string } | null = null;
      if (order.trialApplicationId) {
        const claimed = await tx.trialApplication.updateMany({
          where: { id: order.trialApplicationId, convertedOrderId: null, purgedAt: null },
          data: { convertedOrderId: order.id, convertedAt: now },
        });
        if (claimed.count) {
          trial = await tx.trialApplication.findUniqueOrThrow({ where: { id: order.trialApplicationId }, select: { id: true, number: true } });
          // Denemede yüklenen müşteri dosyaları ücretli siparişe de bağlanır (yeniden yükleme gerekmez)
          await tx.uploadedFile.updateMany({
            where: { trialId: trial.id, orderId: null, kind: { in: [...CUSTOMER_FILE_KINDS] }, status: "UPLOADED" },
            data: { orderId: order.id },
          });
        }
      }
      const countsToward = snapshot.trialCountsTowardPackage ?? true;

      const entitlement = await tx.packageEntitlement.create({
        data: {
          userId: order.userId,
          packageId: order.packageId,
          sourceOrderId: order.id,
          paymentId: payment.id,
          totalVideos: snapshotTotalVideos(snapshot) + (trial && !countsToward ? TRIAL_VIDEO_COUNT : 0),
          usedVideos: order.videoCount,
          startsAt: now,
          endsAt: addMonths(now, snapshot.durationMonths),
        },
      });

      const fileKinds = trial
        ? (await tx.uploadedFile.findMany({ where: { orderId: order.id, status: "UPLOADED" }, select: { kind: true } })).map((f) => f.kind)
        : order.files.map((f) => f.kind);
      const missing = missingRequiredItems({
        style: order.style,
        footageSource: order.footageSource,
        lyricsText: order.song.lyrics,
        fileKinds,
      });
      const nextStatus: OrderStatus = missing.length ? "AWAITING_FILES" : "NEW";
      const previousStatus = order.status;

      // Aylık teslim planı: paketin ilk videoları ilk teslim ayına düşer
      const schedule = deliverySchedule(now, snapshot.videoCount, snapshot.bonusVideoCount ?? 0, snapshot.durationMonths);
      let projectDates = Array.from({ length: order.videoCount }, (_, i) => batchDateForIndex(schedule, i));
      if (trial) {
        // Deneme videoları: son kalite kontrol (1 iş günü). Kalan ilk teslim videoları: paket/sistem iş günü kuralı.
        const days = snapshot.trialConversionBusinessDays ?? trialSettings.conversionBusinessDays;
        const newDue = missing.length ? null : addBusinessDays(now, days);
        projectDates = Array.from({ length: order.videoCount }, (_, i) => (i < TRIAL_VIDEO_COUNT ? addBusinessDays(now, 1) : newDue));
        conversion = { trialNumber: trial.number, newVideos: order.videoCount - TRIAL_VIDEO_COUNT, newDue };
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          entitlementId: entitlement.id,
          paidAt: now,
          dueDate: order.dueDate ?? projectDates.at(-1) ?? null,
          ...(previousStatus === "PAYMENT_PENDING" || previousStatus === "CANCELLED"
            ? { status: nextStatus, cancelledAt: null, cancelReason: null }
            : {}),
        },
      });
      const trialVideos = trial
        ? await tx.trialVideo.findMany({
            where: { trialId: trial.id },
            orderBy: { sequence: "asc" },
            include: { masterFile: { select: { id: true, ownerId: true, status: true } } },
          })
        : [];
      await tx.project.createMany({
        data: Array.from({ length: order.videoCount }, (_, i) => {
          const tv = trialVideos[i];
          return {
            orderId: order.id,
            sequence: i + 1,
            title: tv ? `Deneme videosu ${tv.sequence} (tam sürüm)` : `Video ${i + 1}`,
            dueDate: projectDates[i] ?? null,
            trialVideoId: tv?.id ?? null,
          };
        }),
        skipDuplicates: true,
      });
      if (trialVideos.length) {
        // Deneme videolarının temiz ana dosyaları teslim kaydına bağlanır; son kalite kontrolde ekip yayınlar.
        // Ön izleme dosyaları (kırpılmış/filigranlı) ayrı kalır ve ücretli teslimde kullanılmaz.
        const projects = await tx.project.findMany({ where: { orderId: order.id, trialVideoId: { not: null } }, select: { id: true, trialVideoId: true } });
        for (const tv of trialVideos) {
          const project = projects.find((p) => p.trialVideoId === tv.id);
          if (!project || !tv.masterFile || tv.masterFile.status !== "UPLOADED") continue;
          await tx.deliverable.create({
            data: {
              projectId: project.id,
              orderId: order.id,
              fileId: tv.masterFile.id,
              version: 1,
              uploadedById: tv.masterFile.ownerId,
              note: "Ücretsiz denemede üretilen videonun temiz, tam sürümü (son kalite kontrol bekliyor).",
            },
          });
        }
      }
      await recordCommissionForPayment(tx, { orderId: order.id, paymentId: payment.id, paidKurus: payment.amountKurus, paidAt: now }, commerce);
      await tx.orderEvent.createMany({
        data: [
          {
            orderId: order.id,
            type: "PAYMENT",
            message: `Ödeme alındı: ${formatMoney(payment.amountKurus, payment.currency)}`,
            visibleToCustomer: true,
          },
          ...(conversion
            ? [
                {
                  orderId: order.id,
                  type: "TRIAL_CONVERSION",
                  message: `Ücretsiz deneme (${conversion.trialNumber}) bu siparişe dönüştürüldü: 3 deneme videosunun tam sürümü son kontrolden sonra teslim edilecek; ${conversion.newVideos} yeni video${conversion.newDue ? ` en geç ${formatDate(conversion.newDue)}` : ""}.`,
                  visibleToCustomer: true,
                },
              ]
            : []),
          ...(previousStatus === "PAYMENT_PENDING" || previousStatus === "CANCELLED"
            ? [{ orderId: order.id, type: "STATUS_CHANGE", fromStatus: previousStatus, toStatus: nextStatus, visibleToCustomer: true }]
            : []),
        ],
      });
      return "granted" as const;
    });
  } catch (err) {
    // İki farklı ödeme denemesi aynı anda başarılı olursa ikinci hak oluşturma benzersizlik kısıtına takılır.
    if (isUniqueViolation(err)) {
      await db.payment.update({
        where: { id: paymentId },
        data: {
          status: "SUCCEEDED",
          paidAt: now,
          failureReason: "Mükerrer ödeme — sipariş zaten ödenmişti.",
          providerPaymentId: result.providerPaymentId ?? undefined,
          rawResult: result.raw as Prisma.InputJsonValue,
        },
      });
      outcome = "duplicate";
    } else {
      throw err;
    }
  }

  const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });

  if (outcome === "duplicate") {
    if (payment.failureReason !== "Mükerrer ödeme — sipariş zaten ödenmişti.") {
      await db.payment.update({ where: { id: paymentId }, data: { failureReason: "Mükerrer ödeme — sipariş zaten ödenmişti." } });
    }
    await notifyAdmins({
      title: `Mükerrer ödeme: ${payment.order.number}`,
      body: `Bu sipariş için ikinci bir başarılı ödeme alındı (${formatMoney(payment.amountKurus, payment.currency)}). Müşteriye iade yapılması gerekebilir.`,
      orderId: payment.orderId,
      href: `/admin/siparisler/${payment.order.number}`,
    });
    return outcome;
  }

  if (outcome === "granted" && conversion) {
    const order = payment.order;
    const c = conversion as { trialNumber: string; newVideos: number; newDue: Date | null };
    await notifyUser({
      userId: order.userId,
      type: "PAYMENT_SUCCEEDED",
      orderId: order.id,
      title: `Ödemen alındı: ${order.number}`,
      body: `Üç deneme videonun tam sürümleri son kontrolden sonra panelinde olacak. Kalan ${c.newVideos} video${c.newDue ? ` en geç ${formatDate(c.newDue)}` : ""} teslim edilecek.`,
      email: {
        subject: `Ödemen alındı, paketin aktif (${order.number})`,
        paragraphs: [
          `${formatMoney(payment.amountKurus, payment.currency)} tutarındaki ödemen başarıyla alındı.`,
          "Ücretsiz denemede hazırlanan üç video yeniden üretilmeden paketine dahil edildi; tam ve temiz sürümleri son kalite kontrolden sonra panelinde olacak.",
          `Paketindeki kalan ${c.newVideos} video${c.newDue ? ` en geç ${formatDate(c.newDue)} tarihinde` : ""} teslim edilecek.`,
        ],
        cta: { label: "Siparişimi görüntüle", href: `/panel/siparislerim/${order.number}` },
        footnote: "Kart bilgilerin AddLyrics tarafından görülmez ve saklanmaz.",
      },
    });
    await notifyAdmins({
      title: `Denemeden satın alma: ${order.number}`,
      body: `Deneme ${c.trialNumber}: 3 videonun tam sürümünü son kontrol edip teslim edin. ${c.newVideos} yeni video${c.newDue ? ` — son tarih ${formatDate(c.newDue)}` : ""}.`,
      orderId: order.id,
      href: `/admin/siparisler/${order.number}`,
    });
    return outcome;
  }

  if (outcome === "granted") {
    const order = payment.order;
    await notifyUser({
      userId: order.userId,
      type: "PAYMENT_SUCCEEDED",
      orderId: order.id,
      title: `Ödemen alındı: ${order.number}`,
      body:
        order.status === "AWAITING_FILES"
          ? "Paketin aktif. Üretime başlayabilmemiz için eksik dosyalarını panelden yükleyebilirsin."
          : "Paketin aktif. Ekibimiz siparişini inceleyip bir editöre atayacak.",
      email: {
        subject: `Ödemen alındı, paketin aktif (${order.number})`,
        paragraphs: [
          `${formatMoney(payment.amountKurus, payment.currency)} tutarındaki ödemen başarıyla alındı.`,
          order.status === "AWAITING_FILES"
            ? "Üretime başlayabilmemiz için eksik dosyalarını müşteri panelinden yükleyebilirsin."
            : "Ekibimiz siparişini inceleyip bir editöre atayacak. Süreci müşteri panelinden takip edebilirsin.",
        ],
        cta: { label: "Siparişimi görüntüle", href: `/panel/siparislerim/${order.number}` },
        footnote: "Kart bilgilerin AddLyrics tarafından görülmez ve saklanmaz.",
      },
    });
    await notifyAdmins({
      title: `Yeni ödenmiş sipariş: ${order.number}`,
      body: `${formatMoney(payment.amountKurus, payment.currency)} — durum: ${order.status === "AWAITING_FILES" ? "Dosya Bekleniyor" : "Yeni Sipariş"}.`,
      orderId: order.id,
      href: `/admin/siparisler/${order.number}`,
    });
  }
  return outcome;
}

export async function markPaymentFailed(paymentId: string, reason: string, raw?: Record<string, unknown>) {
  const { count } = await db.payment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { status: "FAILED", failureReason: reason.slice(0, 500), rawResult: (raw ?? undefined) as Prisma.InputJsonValue | undefined },
  });
  if (count) {
    const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
    await notifyUser({
      userId: payment.userId,
      type: "PAYMENT_FAILED",
      orderId: payment.orderId,
      title: `Ödeme tamamlanamadı: ${payment.order.number}`,
      body: "Ödemen tamamlanamadı ve kartından tahsilat yapılmadı. Siparişin kayıtlı; dilediğinde tekrar deneyebilirsin.",
    });
  }
  return count > 0;
}

/**
 * İade: ödemeyi "İade edildi" yapar ve bu ödemeden doğan paket hakkını iptal eder.
 * Mevcut siparişler otomatik iptal edilmez; ekip inceler.
 */
export async function markPaymentRefunded(paymentId: string, actorId: string | null, reason: string) {
  const now = new Date();
  const changed = await db.$transaction(async (tx) => {
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, status: "SUCCEEDED" },
      data: { status: "REFUNDED", refundedAt: now },
    });
    if (!count) return false;
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    await tx.packageEntitlement.updateMany({
      where: { paymentId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: now, revokeReason: reason.slice(0, 300) },
    });
    // İş ortağı komisyonu: ödenmemişse iptal, ödenmişse mahsup için işaretlenir
    await handleCommissionRefund(tx, paymentId, reason);
    await tx.orderEvent.create({
      data: {
        orderId: payment.orderId,
        actorId,
        type: "REFUND",
        message: `Ödeme iade edildi; paket hakkı iptal edildi. ${reason}`.trim(),
        visibleToCustomer: true,
      },
    });
    return true;
  });
  if (changed) {
    const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
    await notifyUser({
      userId: payment.userId,
      type: "STATUS_CHANGED",
      orderId: payment.orderId,
      title: `İade işlendi: ${payment.order.number}`,
      body: "Ödemen iade edildi ve ilgili paket hakkın kapatıldı.",
    });
    await notifyAdmins({
      title: `İade işlendi: ${payment.order.number}`,
      body: `${reason} — Bu paketten açılmış devam eden siparişleri kontrol edin.`,
      orderId: payment.orderId,
      href: `/admin/siparisler/${payment.order.number}`,
    });
  }
  return changed;
}

// ───────────────────────────── Webhook olay kaydı ─────────────────────────────

/**
 * Webhook olayını benzersiz anahtarla kaydeder. Aynı olay daha önce işlendiyse false döner.
 */
export async function recordWebhookEvent(provider: PaymentProvider, eventKey: string, topic: string | null, payload: unknown) {
  try {
    const event = await db.webhookEvent.create({
      data: { provider, eventKey: eventKey.slice(0, 300), topic, payload: payload as Prisma.InputJsonValue },
    });
    return { isNew: true as const, id: event.id };
  } catch (err) {
    if (isUniqueViolation(err)) {
      const existing = await db.webhookEvent.findUnique({
        where: { provider_eventKey: { provider, eventKey: eventKey.slice(0, 300) } },
      });
      // Daha önce hata ile sonuçlanan olay yeniden işlenebilir
      if (existing && !existing.processedAt) return { isNew: true as const, id: existing.id };
      return { isNew: false as const, id: existing?.id ?? null };
    }
    throw err;
  }
}

export async function completeWebhookEvent(id: string, error?: string) {
  await db.webhookEvent.update({
    where: { id },
    data: error ? { error: error.slice(0, 1000) } : { processedAt: new Date(), error: null },
  });
}
