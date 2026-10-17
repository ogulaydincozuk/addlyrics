// Aynı anda tek açılır pencere: duyuru modalı açıkken ücretsiz deneme penceresi bekler.
// Tarayıcıda küçük bir paylaşılan durum; sunucuda hiçbir şey yapmaz.

type Listener = () => void;
let owner: string | null = null;
const listeners = new Set<Listener>();

export function claimOverlay(id: string) {
  if (owner && owner !== id) return false;
  owner = id;
  listeners.forEach((l) => l());
  return true;
}

export function releaseOverlay(id: string) {
  if (owner !== id) return;
  owner = null;
  listeners.forEach((l) => l());
}

export function overlayOwner() {
  return owner;
}

export function subscribeOverlay(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** localStorage erişimi gizli modda/engelli olabilir; hata sessizce yutulur */
export function readStore(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStore(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* depolama kapalı: davranış yalnızca bu oturum için geçerli olur */
  }
}
