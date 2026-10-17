import "server-only";
import { maskName } from "@/lib/referral";
import { db } from "../db";

/**
 * İş ortağı paneli verisi. Tüm sorgular yalnızca verilen iş ortağının kimliğiyle sınırlıdır;
 * müşteri adları maskelenir, e-posta/telefon gibi iletişim bilgileri hiç döndürülmez.
 */
export async function getPartnerDashboard(partnerId: string) {
  const [codes, commissions, payouts, pendingOrders] = await Promise.all([
    db.referralCode.findMany({
      where: { partnerId },
      include: { packages: { select: { name: true } }, packageRates: { select: { commissionRateBps: true, package: { select: { name: true, sortOrder: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    db.commission.findMany({
      where: { partnerId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        status: true,
        amountKurus: true,
        clawbackAt: true,
        eligibleAt: true,
        createdAt: true,
        referralCode: { select: { code: true } },
        payment: { select: { status: true } },
        order: { select: { number: true, createdAt: true, package: { select: { name: true } }, user: { select: { name: true } } } },
      },
    }),
    db.commissionPayout.findMany({ where: { partnerId }, orderBy: { paidAt: "desc" }, take: 50 }),
    db.order.count({ where: { partnerId, status: "PAYMENT_PENDING" } }),
  ]);
  return {
    codes,
    payouts,
    pendingOrders,
    commissions: commissions.map((c) => ({
      ...c,
      order: { number: c.order.number, createdAt: c.order.createdAt, packageName: c.order.package.name, customer: maskName(c.order.user.name) },
    })),
  };
}

export type PartnerDashboard = Awaited<ReturnType<typeof getPartnerDashboard>>;
