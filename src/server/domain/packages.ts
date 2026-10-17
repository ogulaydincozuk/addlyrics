import "server-only";
import type { Package, PackageChannelListing } from "@prisma/client";
import { saleState, type SaleState } from "@/lib/packages";
import { samplePackagesAllowed } from "../env";
import { activeProviderId } from "../payments/config";

export type PackageWithListings = Package & { channelListings?: PackageChannelListing[] };

/**
 * Sunucu tarafında paketin satılabilirliği. Shopify seçiliyse paketin Shopify varyantıyla
 * eşlenmiş ve fiyatının AddLyrics fiyatıyla aynı olması gerekir.
 */
export function packageSaleState(pkg: PackageWithListings): SaleState {
  const provider = activeProviderId();
  let paymentsAvailable = provider !== null;
  if (provider === "SHOPIFY") {
    const listing = pkg.channelListings?.find((l) => l.channel === "SHOPIFY");
    paymentsAvailable = Boolean(listing && listing.externalPriceKurus === pkg.priceKurus && listing.currency === pkg.currency);
  }
  return saleState(pkg, { allowSamplePackages: samplePackagesAllowed(), paymentsAvailable });
}

export const SALE_STATE_MESSAGES: Record<Exclude<SaleState, { purchasable: true }>["reason"], string> = {
  not_published: "Bu paket şu anda satışta değil.",
  incomplete: "Bu paketin fiyatı ve koşulları henüz belirlenmedi.",
  sample: "Bu paket örnek veridir ve satın alınamaz.",
  payments_unavailable: "Online ödeme henüz aktif değil. Paket satışları ödeme altyapısı yapılandırıldığında açılacak.",
};
