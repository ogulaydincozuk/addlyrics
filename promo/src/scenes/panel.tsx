import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, exitStyle, fadeUp, pop, progress } from "../anim";
import { Browser, Cursor } from "../components/devices";
import { LyricMini, type LyricKind } from "../components/lyric-mini";
import { Icon, Logo, SceneTitle, type IconName } from "../components/ui";
import { C, FONT } from "../theme";

// Sitedeki müşteri paneli menüsü (src/app/(site)/panel/panel-nav.tsx)
const NAV: { label: string; icon: IconName }[] = [
  { label: "Genel Bakış", icon: "layout-dashboard" },
  { label: "Yeni Şarkı Gönder", icon: "circle-plus" },
  { label: "Paketlerim", icon: "package" },
  { label: "Siparişlerim", icon: "list-music" },
  { label: "Şarkılarım", icon: "music" },
  { label: "Dosyalarım", icon: "file-stack" },
  { label: "Teslim Edilen Videolar", icon: "circle-play" },
  { label: "Ödeme Geçmişi", icon: "credit-card" },
  { label: "Hesap Ayarları", icon: "settings" },
];

const VIEW_B = 118; // teslimler
const VIEW_C = 214; // mesajlar
const BX = 210;
const BY = 214;
const BW = 1500;
const BH = 740;
const SIDEBAR = 330;

export function Panel({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const view = frame < VIEW_B ? 0 : frame < VIEW_C ? 1 : 2;
  const activeNav = view === 0 ? 0 : view === 1 ? 6 : 3;
  const navY = (i: number) => 104 + i * 58;
  const hl = interpolate(frame, [VIEW_B - 10, VIEW_B, VIEW_C - 10, VIEW_C], [navY(0), navY(6), navY(6), navY(3)], CLAMP);

  return (
    <AbsoluteFill style={exitStyle(frame, duration)}>
      <div style={{ position: "absolute", top: 52, left: 0, right: 0 }}>
        <SceneTitle kicker="Müşteri paneli" title="Her şey tek bir panelde." size={58} />
      </div>

      <div style={{ position: "absolute", left: BX, top: BY, ...fadeUp(frame, 6, 60, 26) }}>
        <Browser width={BW} height={BH} label="AddLyrics · Müşteri paneli">
          <div style={{ display: "flex", height: "100%" }}>
            <div style={{ width: SIDEBAR, borderRight: `1.5px solid ${C.line}`, background: "#fbfcfe", padding: "26px 20px", position: "relative" }}>
              <Logo size={30} />
              <div style={{ position: "absolute", left: 16, right: 16, top: hl - 10, height: 50, borderRadius: 12, background: C.brandTint, border: `1.5px solid ${C.brandSoft}` }} />
              {NAV.map((n, i) => (
                <div key={n.label} style={{ position: "absolute", left: 32, top: navY(i), display: "flex", alignItems: "center", gap: 14, fontFamily: FONT.sans, fontSize: 19, fontWeight: i === activeNav ? 700 : 500, color: i === activeNav ? C.brandInk : C.inkSoft }}>
                  <Icon name={n.icon} size={22} color={i === activeNav ? C.brand : C.muted} />
                  {n.label}
                </div>
              ))}
            </div>
            <div style={{ flex: 1, position: "relative", background: C.canvas }}>
              <View show={view === 0} frame={frame} start={0}>
                <Overview frame={frame} />
              </View>
              <View show={view === 1} frame={frame} start={VIEW_B}>
                <Deliveries frame={frame - VIEW_B} />
              </View>
              <View show={view === 2} frame={frame} start={VIEW_C}>
                <Messages frame={frame - VIEW_C} />
              </View>
            </div>
          </div>
        </Browser>
      </div>

      <Cursor
        keys={[
          { f: 70, x: BX + 900, y: BY + 500 },
          { f: VIEW_B - 14, x: BX + 150, y: BY + 58 + navY(6) + 12 },
          { f: VIEW_B - 8, x: BX + 150, y: BY + 58 + navY(6) + 12, click: true },
          { f: VIEW_B + 40, x: BX + SIDEBAR + 130, y: BY + 58 + 485 },
          { f: VIEW_B + 46, x: BX + SIDEBAR + 130, y: BY + 58 + 485, click: true },
          { f: VIEW_C - 14, x: BX + 130, y: BY + 58 + navY(3) + 12 },
          { f: VIEW_C - 8, x: BX + 130, y: BY + 58 + navY(3) + 12, click: true },
          { f: VIEW_C + 40, x: BX + 1100, y: BY + 640 },
        ]}
      />

      <div style={{ position: "absolute", top: 985, left: 0, right: 0, textAlign: "center", fontFamily: FONT.sans, fontSize: 28, fontWeight: 600, color: C.inkSoft, ...fadeUp(frame, VIEW_C + 70, 20) }}>
        Üretime başlamadan önce ekibimiz <span style={{ color: C.brand }}>gerekli soruları sorar</span>, videolar tercihlerine göre hazırlanır.
      </div>
    </AbsoluteFill>
  );
}

function View({ show, frame, start, children }: { show: boolean; frame: number; start: number; children: React.ReactNode }) {
  if (!show) return null;
  const p = progress(frame, start, 14);
  return <div style={{ position: "absolute", inset: 0, padding: "30px 36px", opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>{children}</div>;
}

function H({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div>
      <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 32, color: C.ink }}>{children}</div>
      {sub && <div style={{ marginTop: 4, fontFamily: FONT.sans, fontSize: 18, color: C.muted }}>{sub}</div>}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#fff", borderRadius: 20, border: `1.5px solid ${C.line}`, padding: 22, boxShadow: "0 1px 2px rgb(15 23 42 / 0.04)", ...style }}>{children}</div>;
}

const STATUS = ["Yeni Sipariş", "Editöre Atandı", "Hazırlanıyor", "Kontrol Ediliyor", "Teslim Edildi"];

function Overview({ frame }: { frame: number }) {
  const left = Math.round(interpolate(frame, [20, 60], [105, 75], CLAMP));
  const used = (105 - left) / 105;
  const track = interpolate(frame, [40, 90], [0, 2], CLAMP);
  return (
    <div>
      <H sub="Paketin, siparişlerin ve teslimlerin burada.">Genel Bakış</H>
      <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
        {[
          { icon: "circle-play" as IconName, label: "Kalan video hakkı", value: `${left}`, extra: "/ 105", bar: 1 - used },
          { icon: "calendar-check" as IconName, label: "Sonraki teslim", value: "1 Aralık", extra: "30 video" },
          { icon: "list-music" as IconName, label: "Aktif sipariş", value: "1", extra: "Hazırlanıyor" },
        ].map((s, i) => (
          <Card key={s.label} style={{ opacity: Math.min(1, pop(frame, 10 + i * 6)), transform: `translateY(${(1 - Math.min(1, pop(frame, 10 + i * 6))) * 30}px)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: FONT.sans, fontSize: 17, fontWeight: 700, color: C.muted }}>
              <Icon name={s.icon} size={20} color={C.brand} />
              {s.label}
            </div>
            <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 46, color: C.ink }}>{s.value}</span>
              <span style={{ fontFamily: FONT.sans, fontSize: 19, color: C.muted, fontWeight: 600 }}>{s.extra}</span>
            </div>
            {s.bar !== undefined && (
              <div style={{ marginTop: 12, height: 10, borderRadius: 10, background: C.brandSoft, overflow: "hidden" }}>
                <div style={{ width: `${s.bar * 100}%`, height: "100%", background: C.brand, borderRadius: 10 }} />
              </div>
            )}
          </Card>
        ))}
      </div>
      <Card style={{ marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 24, color: C.ink }}>Deniz Beat – Gece Yarısı Ritmi</div>
          <span style={{ padding: "6px 14px", borderRadius: 99, background: C.progressSoft, color: C.progress, fontFamily: FONT.sans, fontWeight: 700, fontSize: 17 }}>Hazırlanıyor</span>
        </div>
        <div style={{ marginTop: 22, display: "flex", alignItems: "center" }}>
          {STATUS.map((s, i) => {
            const done = track >= i;
            return (
              <React.Fragment key={s}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: 130 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 34, background: done ? C.brand : "#fff", border: `2px solid ${done ? C.brand : C.lineStrong}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {done && <Icon name="check" size={18} color="#fff" strokeWidth={3} />}
                  </span>
                  <span style={{ fontFamily: FONT.sans, fontSize: 16, fontWeight: 600, color: done ? C.ink : C.muted, textAlign: "center" }}>{s}</span>
                </div>
                {i < STATUS.length - 1 && (
                  <div style={{ flex: 1, height: 4, marginBottom: 30, borderRadius: 4, background: C.line, overflow: "hidden" }}>
                    <div style={{ width: `${Math.max(0, Math.min(1, track - i)) * 100}%`, height: "100%", background: C.brand }} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </Card>
      <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Card style={{ display: "flex", alignItems: "center", gap: 14, ...fadeUp(frame, 60, 20) }}>
          <Icon name="bell" size={24} color={C.brand} />
          <span style={{ fontFamily: FONT.sans, fontSize: 18, color: C.inkSoft }}>
            <b style={{ color: C.ink }}>Yeni mesaj:</b> Ekibimiz siparişinle ilgili bir soru sordu.
          </span>
        </Card>
        <Card style={{ display: "flex", alignItems: "center", gap: 14, ...fadeUp(frame, 66, 20) }}>
          <Icon name="receipt" size={24} color={C.brand} />
          <span style={{ fontFamily: FONT.sans, fontSize: 18, color: C.inkSoft }}>
            <b style={{ color: C.ink }}>Ödeme Geçmişi:</b> 3 Aylık Paket · ₺9.400
          </span>
        </Card>
      </div>
    </div>
  );
}

const DELIVERED: { kind: LyricKind; title: string }[] = [
  { kind: "film", title: "Gece Yarısı Ritmi #1" },
  { kind: "minimal", title: "Gece Yarısı Ritmi #2" },
  { kind: "clip", title: "Gece Yarısı Ritmi #3" },
  { kind: "film", title: "Gece Yarısı Ritmi #4" },
  { kind: "minimal", title: "Gece Yarısı Ritmi #5" },
];

function Deliveries({ frame }: { frame: number }) {
  const thumbW = 168;
  return (
    <div>
      <H sub="Tamamlanan videolarını izle ve indir.">Teslim Edilen Videolar</H>
      <div style={{ marginTop: 24, display: "flex", gap: 20 }}>
        {DELIVERED.map((d, i) => {
          const p = Math.min(1, pop(frame, 6 + i * 5, 14));
          const downloaded = i === 0 && frame >= 46;
          return (
            <div key={d.title} style={{ width: thumbW + 20, padding: 10, borderRadius: 18, background: "#fff", border: `1.5px solid ${C.line}`, opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
              <div style={{ width: thumbW, height: (thumbW * 16) / 9, borderRadius: 12, overflow: "hidden", position: "relative" }}>
                <LyricMini kind={d.kind} frame={frame + i * 20} w={thumbW} lineDur={48} badge={false} />
              </div>
              <div style={{ marginTop: 10, fontFamily: FONT.sans, fontSize: 16, fontWeight: 700, color: C.ink }}>{d.title}</div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 0", borderRadius: 10, background: downloaded ? C.successSoft : C.lime, fontFamily: FONT.sans, fontSize: 16, fontWeight: 800, color: downloaded ? C.success : C.ink }}>
                <Icon name={downloaded ? "check" : "download"} size={18} color={downloaded ? C.success : C.ink} strokeWidth={2.5} />
                {downloaded ? "İndirildi" : "İndir"}
              </div>
            </div>
          );
        })}
      </div>
      <Card style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 18, padding: "18px 22px", ...fadeUp(frame, 34, 20) }}>
        <Icon name="calendar-check" size={26} color={C.brand} />
        {[
          { t: "1. teslim · 1 Kasım · 30 video", done: true },
          { t: "2. teslim · 1 Aralık · 30 video", done: false },
          { t: "3. teslim · 1 Ocak · 45 video", done: false },
        ].map((d) => (
          <span key={d.t} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: d.done ? C.successSoft : C.canvas, border: `1.5px solid ${d.done ? "#bbf7d0" : C.line}`, fontFamily: FONT.sans, fontSize: 17, fontWeight: 700, color: d.done ? C.success : C.inkSoft }}>
            {d.done && <Icon name="check" size={16} color={C.success} strokeWidth={3} />}
            {d.t}
          </span>
        ))}
      </Card>
    </div>
  );
}

function Messages({ frame }: { frame: number }) {
  const q = Math.min(1, pop(frame, 14, 15));
  const typing = frame >= 44 && frame < 72;
  const a = Math.min(1, pop(frame, 72, 15));
  return (
    <div>
      <H sub="Sipariş AL-2610-7K2QX · Deniz Beat – Gece Yarısı Ritmi">Siparişlerim</H>
      <Card style={{ marginTop: 22, padding: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: FONT.display, fontWeight: 800, fontSize: 24, color: C.ink }}>
          <Icon name="message-square-text" size={26} color={C.brand} /> Mesajlar
        </div>
        <div style={{ marginTop: 6, fontFamily: FONT.sans, fontSize: 17, color: C.muted }}>Hazırlık süreci: üretime başlamadan önce ekibimiz gerekli soruları sorar.</div>
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 16, minHeight: 300 }}>
          <div style={{ alignSelf: "flex-start", maxWidth: 640, opacity: q, transform: `translateY(${(1 - q) * 24}px) scale(${0.96 + q * 0.04})`, transformOrigin: "left bottom" }}>
            <div style={{ fontFamily: FONT.sans, fontSize: 15, fontWeight: 700, color: C.brand, marginBottom: 6 }}>AddLyrics ekibi</div>
            <div style={{ padding: "16px 20px", borderRadius: "18px 18px 18px 6px", background: "#fff", border: `1.5px solid ${C.brandSoft}`, fontFamily: FONT.sans, fontSize: 21, color: C.ink, lineHeight: 1.45 }}>
              Merhaba! Nakaratta hangi satırın öne çıkmasını istersin? Yazı rengi için bir tercihin var mı?
            </div>
          </div>
          {typing && (
            <div style={{ alignSelf: "flex-end", padding: "14px 20px", borderRadius: 18, background: C.brandSoft, display: "flex", gap: 7 }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ width: 10, height: 10, borderRadius: 10, background: C.brand, opacity: 0.4 + 0.6 * Math.abs(Math.sin((frame + i * 5) / 6)) }} />
              ))}
            </div>
          )}
          {frame >= 72 && (
            <div style={{ alignSelf: "flex-end", maxWidth: 640, opacity: a, transform: `translateY(${(1 - a) * 24}px) scale(${0.96 + a * 0.04})`, transformOrigin: "right bottom", textAlign: "right" }}>
              <div style={{ fontFamily: FONT.sans, fontSize: 15, fontWeight: 700, color: C.muted, marginBottom: 6 }}>Sen</div>
              <div style={{ padding: "16px 20px", borderRadius: "18px 18px 6px 18px", background: C.lime, fontFamily: FONT.sans, fontSize: 21, color: C.ink, lineHeight: 1.45, textAlign: "left" }}>
                “Sabaha kadar bu şarkı benimle” satırı öne çıksın. Yazılar beyaz olsun.
              </div>
            </div>
          )}
        </div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14, border: `1.5px solid ${C.line}`, fontFamily: FONT.sans, fontSize: 18, color: C.muted }}>
          <span style={{ flex: 1 }}>Ekibe yaz…</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, background: C.lime, color: C.ink, fontWeight: 800 }}>
            <Icon name="send" size={18} color={C.ink} /> Gönder
          </span>
        </div>
      </Card>
    </div>
  );
}
