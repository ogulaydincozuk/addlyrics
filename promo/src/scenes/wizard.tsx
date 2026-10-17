import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, exitStyle, fadeUp, pop, progress } from "../anim";
import { Browser, Cursor } from "../components/devices";
import { Icon, SceneTitle, type IconName } from "../components/ui";
import { C, FONT } from "../theme";

// Sitedeki sihirbaz adımları (src/components/order/order-wizard.tsx)
const STEPS = ["Şarkı", "Video tarzı", "Format", "Dosyalar", "Özet"];
const STEP_START = 24;
const STEP_LEN = 46;
const stepAt = (frame: number) => Math.max(0, Math.min(STEPS.length - 1, Math.floor((frame - STEP_START) / STEP_LEN)));

// tarayıcının sahnedeki konumu (imleç koordinatları için)
const BX = 260;
const BY = 222;
const BW = 1400;
const BH = 720;

export function Wizard({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const step = stepAt(frame);
  const local = frame - STEP_START - step * STEP_LEN;
  const s0 = STEP_START;
  const L = STEP_LEN;

  return (
    <AbsoluteFill style={exitStyle(frame, duration)}>
      <div style={{ position: "absolute", top: 56, left: 0, right: 0 }}>
        <SceneTitle kicker="Kolay sipariş" title="Siparişini 5 adımda oluştur." size={58} />
      </div>

      <div style={{ position: "absolute", left: BX, top: BY, ...fadeUp(frame, 6, 60, 26) }}>
        <Browser width={BW} height={BH} label="AddLyrics · Yeni sipariş">
          <div style={{ display: "flex", height: "100%" }}>
            <div style={{ flex: 1, padding: "30px 44px" }}>
              <Stepper frame={frame} step={step} />
              <div style={{ marginTop: 30, position: "relative", height: 480 }}>
                <StepPanel key={step} local={local} step={step} />
              </div>
            </div>
            <Summary frame={frame} step={step} />
          </div>
        </Browser>
      </div>

      <Cursor
        keys={[
          { f: s0 + 6, x: BX + 600, y: BY + 300 },
          { f: s0 + L * 1 + 12, x: BX + 190, y: BY + 330 },
          { f: s0 + L * 1 + 18, x: BX + 190, y: BY + 330, click: true },
          { f: s0 + L * 2 + 10, x: BX + 120, y: BY + 300 },
          { f: s0 + L * 2 + 14, x: BX + 120, y: BY + 300, click: true },
          { f: s0 + L * 2 + 26, x: BX + 210, y: BY + 470, click: true },
          { f: s0 + L * 3 + 6, x: BX + 520, y: BY + 250, click: true },
          { f: s0 + L * 3 + 30, x: BX + 560, y: BY + 260 },
          { f: s0 + L * 4 + 8, x: BX + 60, y: BY + 462 },
          { f: s0 + L * 4 + 12, x: BX + 60, y: BY + 462, click: true },
          { f: s0 + L * 4 + 20, x: BX + 60, y: BY + 503, click: true },
          { f: s0 + L * 4 + 34, x: BX + 170, y: BY + 566 },
          { f: s0 + L * 4 + 40, x: BX + 170, y: BY + 566, click: true },
          { f: s0 + L * 4 + 80, x: BX + 260, y: BY + 600 },
        ]}
      />

      <Toast frame={frame} start={s0 + L * 4 + 44} />
    </AbsoluteFill>
  );
}

function Stepper({ frame, step }: { frame: number; step: number }) {
  return (
    <div>
      <div style={{ fontFamily: FONT.sans, fontSize: 18, color: C.muted, fontWeight: 600 }}>
        Adım {step + 1} / {STEPS.length}: <span style={{ color: C.ink }}>{STEPS[step]}</span>
      </div>
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
        {STEPS.map((s, i) => {
          const done = i < step;
          const cur = i === step;
          const bar = i < STEPS.length - 1 ? interpolate(frame, [STEP_START + (i + 1) * STEP_LEN - 8, STEP_START + (i + 1) * STEP_LEN], [0, 1], CLAMP) : 0;
          return (
            <React.Fragment key={s}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: FONT.sans,
                    fontWeight: 800,
                    fontSize: 18,
                    background: done ? C.brand : cur ? C.lime : "#fff",
                    color: done ? "#fff" : C.ink,
                    border: `2px solid ${done ? C.brand : cur ? C.limeDeep : C.line}`,
                    transform: `scale(${cur ? 1 + (1 - progress(frame, STEP_START + i * STEP_LEN, 12)) * 0.3 : 1})`,
                  }}
                >
                  {done ? <Icon name="check" size={20} color="#fff" strokeWidth={3} /> : i + 1}
                </span>
                <span style={{ fontFamily: FONT.sans, fontSize: 18, fontWeight: 700, color: cur || done ? C.ink : C.muted }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 4, borderRadius: 4, background: C.line, overflow: "hidden" }}>
                  <div style={{ width: `${bar * 100}%`, height: "100%", background: C.brand }} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function StepPanel({ step, local }: { step: number; local: number }) {
  const enter = progress(local, 0, 12);
  const style: React.CSSProperties = { position: "absolute", inset: 0, opacity: enter, transform: `translateX(${(1 - enter) * 50}px)` };
  if (step === 0) return <SongStep local={local} style={style} />;
  if (step === 1) return <StyleStep local={local} style={style} />;
  if (step === 2) return <FormatStep local={local} style={style} />;
  if (step === 3) return <FilesStep local={local} style={style} />;
  return <SummaryStep local={local} style={style} />;
}

function Field({ label, value, typed = 1, tall = false }: { label: string; value: string; typed?: number; tall?: boolean }) {
  const shown = value.slice(0, Math.round(value.length * typed));
  return (
    <div>
      <div style={{ fontFamily: FONT.sans, fontSize: 17, fontWeight: 700, color: C.inkSoft, marginBottom: 8 }}>{label}</div>
      <div style={{ minHeight: tall ? 120 : 52, padding: "13px 16px", borderRadius: 12, border: `1.5px solid ${typed < 1 && typed > 0 ? C.brand : C.lineStrong}`, boxShadow: typed < 1 && typed > 0 ? `0 0 0 4px ${C.brandSoft}` : "none", fontFamily: FONT.sans, fontSize: 20, color: C.ink, whiteSpace: "pre-line", lineHeight: 1.45 }}>
        {shown}
        {typed > 0 && typed < 1 && <span style={{ display: "inline-block", width: 2, height: 22, background: C.ink, marginLeft: 2, verticalAlign: "middle" }} />}
      </div>
    </div>
  );
}

function SongStep({ local, style }: { local: number; style: React.CSSProperties }) {
  return (
    <div style={{ ...style, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, alignContent: "start" }}>
      <Field label="Sanatçı adı" value="Deniz Beat" typed={progress(local, 4, 10, (x) => x)} />
      <Field label="Şarkı adı" value="Gece Yarısı Ritmi" typed={progress(local, 14, 12, (x) => x)} />
      <Field label="Yayın durumu" value="Yakında yayınlanacak" typed={progress(local, 26, 1)} />
      <Field label="Şarkı dili" value="Türkçe" typed={progress(local, 26, 1)} />
      <div style={{ gridColumn: "1 / -1" }}>
        <Field label="Şarkı sözleri" value={"Gece boyunca aynı sokaklar\nKulaklıkta tek bir ses yankılanır\nSabaha kadar bu şarkı benimle"} typed={progress(local, 28, 16, (x) => x)} tall />
      </div>
    </div>
  );
}

function OptionCard({ icon, title, desc, selected, style }: { icon: IconName; title: string; desc: string; selected: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: 22, borderRadius: 18, border: `2px solid ${selected ? C.brand : C.line}`, background: selected ? C.brandTint : "#fff", boxShadow: selected ? `0 0 0 4px ${C.brandSoft}` : "none", position: "relative", ...style }}>
      <span style={{ width: 52, height: 52, borderRadius: 14, background: selected ? C.lime : C.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={28} color={C.ink} />
      </span>
      <div style={{ marginTop: 14, fontFamily: FONT.display, fontWeight: 800, fontSize: 24, color: C.ink }}>{title}</div>
      <div style={{ marginTop: 6, fontFamily: FONT.sans, fontSize: 17, color: C.muted, lineHeight: 1.4 }}>{desc}</div>
      {selected && (
        <span style={{ position: "absolute", top: 16, right: 16, width: 30, height: 30, borderRadius: 30, background: C.brand, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="check" size={18} color="#fff" strokeWidth={3} />
        </span>
      )}
    </div>
  );
}

function StyleStep({ local, style }: { local: number; style: React.CSSProperties }) {
  const picked = local >= 18;
  return (
    <div style={style}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
        <OptionCard icon="film" title="Film Edit" desc="Sinematik görüntüler ve film atmosferi" selected={picked} />
        <OptionCard icon="type" title="Minimal" desc="Sade zemin ve güçlü tipografi" selected={false} />
        <OptionCard icon="clapperboard" title="Music Video" desc="Kendi klibinin üzerine sözler" selected={false} />
      </div>
      <div style={{ marginTop: 24, padding: "16px 20px", borderRadius: 14, border: `1.5px solid ${C.line}`, display: "flex", alignItems: "center", gap: 14, fontFamily: FONT.sans, fontSize: 19, color: C.inkSoft, opacity: progress(local, 22, 10) }}>
        <span style={{ width: 24, height: 24, borderRadius: 24, border: `2px solid ${C.brand}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ width: 12, height: 12, borderRadius: 12, background: C.brand }} />
        </span>
        AddLyrics lisanslı stok görüntü kullansın
      </div>
      <div style={{ marginTop: 20, opacity: progress(local, 24, 8) }}>
        <Field label="Editöre notun (isteğe bağlı)" value="Nakaratta yavaş geçişler ve gece şehir görüntüleri olsun." typed={progress(local, 26, 16, (x) => x)} />
      </div>
    </div>
  );
}

function FormatStep({ local, style }: { local: number; style: React.CSSProperties }) {
  const formats = [
    { label: "9:16 Dikey", w: 27, h: 48, on: local >= 14 },
    { label: "16:9 Yatay", w: 64, h: 36, on: false },
    { label: "1:1 Kare", w: 44, h: 44, on: local >= 30 },
  ];
  const platforms = [
    { label: "TikTok", on: local >= 20 },
    { label: "Instagram Reels", on: local >= 24 },
    { label: "YouTube Shorts", on: local >= 28 },
    { label: "YouTube", on: false },
  ];
  return (
    <div style={style}>
      <div style={{ fontFamily: FONT.sans, fontSize: 17, fontWeight: 700, color: C.inkSoft, marginBottom: 12 }}>Video formatı</div>
      <div style={{ display: "flex", gap: 18 }}>
        {formats.map((f) => (
          <div key={f.label} style={{ width: 200, height: 150, borderRadius: 18, border: `2px solid ${f.on ? C.brand : C.line}`, background: f.on ? C.brandTint : "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <span style={{ width: f.w, height: f.h, borderRadius: 6, border: `3px solid ${f.on ? C.brand : C.lineStrong}`, background: f.on ? C.lime : "transparent" }} />
            <span style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 19, color: C.ink }}>{f.label}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 26, fontFamily: FONT.sans, fontSize: 17, fontWeight: 700, color: C.inkSoft, marginBottom: 12 }}>Yayınlanacak platformlar</div>
      <div style={{ display: "flex", gap: 12 }}>
        {platforms.map((p) => (
          <span key={p.label} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 12, border: `1.5px solid ${p.on ? C.brand : C.line}`, background: p.on ? C.brandTint : "#fff", fontFamily: FONT.sans, fontWeight: 700, fontSize: 19, color: p.on ? C.brandInk : C.inkSoft }}>
            {p.on && <Icon name="check" size={18} color={C.brand} strokeWidth={3} />}
            {p.label}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 18, padding: "16px 20px", borderRadius: 14, border: `1.5px solid ${C.line}`, width: 640, opacity: progress(local, 30, 10) }}>
        <Icon name="circle-play" size={24} color={C.brand} />
        <span style={{ flex: 1, fontFamily: FONT.sans, fontSize: 19, fontWeight: 600, color: C.inkSoft }}>Bu şarkı için hazırlanacak video</span>
        <span style={{ width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.sans, fontSize: 22, color: C.muted }}>–</span>
        <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 26, color: C.ink, width: 44, textAlign: "center" }}>{Math.round(interpolate(local, [32, 44], [10, 30], CLAMP))}</span>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: C.lime, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.sans, fontSize: 22, color: C.ink }}>+</span>
      </div>
    </div>
  );
}

function FilesStep({ local, style }: { local: number; style: React.CSSProperties }) {
  const files: { name: string; kind: string; icon: IconName; start: number; len: number }[] = [
    { name: "gece-yarisi-ritmi.mp3", kind: "Şarkı dosyası", icon: "file-audio", start: 2, len: 22 },
    { name: "sozler.txt", kind: "Şarkı sözleri", icon: "file-text", start: 8, len: 10 },
    { name: "klip.mp4", kind: "Müzik klibi (isteğe bağlı)", icon: "video", start: 14, len: 30 },
  ];
  return (
    <div style={{ ...style, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ height: 110, borderRadius: 18, border: `2px dashed ${C.limeDeep}`, background: C.brandTint, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontFamily: FONT.sans, fontWeight: 700, fontSize: 21, color: C.brandInk }}>
        <Icon name="upload" size={28} color={C.brand} /> Dosyalarını sürükle bırak veya seç
      </div>
      {files.map((f) => {
        const p = progress(local, f.start, f.len, (x) => x);
        return (
          <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", borderRadius: 14, border: `1.5px solid ${C.line}`, opacity: progress(local, f.start - 2, 6) }}>
            <span style={{ width: 46, height: 46, borderRadius: 12, background: C.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name={f.icon} size={24} color={C.inkSoft} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT.sans, fontSize: 19 }}>
                <span style={{ fontWeight: 700, color: C.ink }}>{f.name}</span>
                <span style={{ color: p >= 1 ? C.success : C.muted, fontWeight: 700 }}>{p >= 1 ? "Yüklendi" : `%${Math.round(p * 100)}`}</span>
              </div>
              <div style={{ marginTop: 8, height: 7, borderRadius: 7, background: C.line, overflow: "hidden" }}>
                <div style={{ width: `${p * 100}%`, height: "100%", background: p >= 1 ? C.success : C.brand }} />
              </div>
              <div style={{ marginTop: 6, fontFamily: FONT.sans, fontSize: 15, color: C.muted }}>{f.kind}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Check({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: FONT.sans, fontSize: 19, color: C.inkSoft }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, border: `2px solid ${on ? C.brand : C.lineStrong}`, background: on ? C.brand : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {on && <Icon name="check" size={18} color="#fff" strokeWidth={3} />}
      </span>
      {children}
    </div>
  );
}

function SummaryStep({ local, style }: { local: number; style: React.CSSProperties }) {
  const rows = [
    ["Şarkı", "Deniz Beat – Gece Yarısı Ritmi"],
    ["Tarz", "Film Edit"],
    ["Format", "9:16 Dikey · 1:1 Kare"],
    ["Platform", "TikTok · Instagram Reels · YouTube Shorts"],
    ["Dosyalar", "3 dosya yüklendi"],
  ];
  const pressed = local >= 40 && local < 46;
  return (
    <div style={style}>
      <div style={{ borderRadius: 16, border: `1.5px solid ${C.line}`, overflow: "hidden" }}>
        {rows.map(([k, v], i) => (
          <div key={k} style={{ display: "flex", padding: "12px 18px", background: i % 2 ? "#fff" : C.canvas, fontFamily: FONT.sans, fontSize: 19 }}>
            <span style={{ width: 150, color: C.muted, fontWeight: 600 }}>{k}</span>
            <span style={{ color: C.ink, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <Check on={local >= 12}>Şarkının ve gönderdiğim materyallerin kullanım haklarına sahibim.</Check>
        <Check on={local >= 20}>Teslimat koşullarını okudum, kabul ediyorum.</Check>
      </div>
      <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", gap: 10, padding: "16px 30px", borderRadius: 14, background: pressed ? C.limeDeep : C.lime, fontFamily: FONT.sans, fontWeight: 800, fontSize: 21, color: C.ink, transform: `scale(${pressed ? 0.96 : 1})`, boxShadow: "0 12px 26px -14px rgb(150 190 20 / 0.9)" }}>
        Ödemeye geç <Icon name="arrow-right" size={22} color={C.ink} />
      </div>
    </div>
  );
}

function Summary({ frame, step }: { frame: number; step: number }) {
  return (
    <div style={{ width: 360, borderLeft: `1.5px solid ${C.line}`, background: C.canvas, padding: "30px 28px" }}>
      <div style={{ fontFamily: FONT.sans, fontSize: 15, fontWeight: 800, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Seçilen paket</div>
      <div style={{ marginTop: 10, fontFamily: FONT.display, fontWeight: 800, fontSize: 28, color: C.ink }}>3 Aylık Paket</div>
      <div style={{ marginTop: 4, fontFamily: FONT.sans, fontSize: 19, color: C.inkSoft }}>90 + 15 bonus video</div>
      <div style={{ marginTop: 20, padding: 18, borderRadius: 16, background: "#fff", border: `1.5px solid ${C.line}` }}>
        {[
          ["Tutar", "₺9.400"],
          ["Video başına", "₺89,52"],
          ["Ödeme", "Tek seferlik"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontFamily: FONT.sans, fontSize: 18 }}>
            <span style={{ color: C.muted }}>{k}</span>
            <span style={{ color: C.ink, fontWeight: 700 }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: FONT.sans, fontSize: 17, color: i < step ? C.ink : C.muted, fontWeight: 600, opacity: i <= step ? 1 : 0.6 }}>
            <Icon name={i < step ? "badge-check" : "clock"} size={20} color={i < step ? C.success : C.lineStrong} />
            {s}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 10, fontFamily: FONT.sans, fontSize: 16, color: C.muted, opacity: fadeUp(frame, 30).opacity }}>
        <Icon name="shield-check" size={20} color={C.brand} />
        Kart bilgilerin AddLyrics tarafından görülmez ve saklanmaz.
      </div>
    </div>
  );
}

function Toast({ frame, start }: { frame: number; start: number }) {
  const p = pop(frame, start, 14, 140);
  if (frame < start) return null;
  return (
    <div style={{ position: "absolute", left: "50%", top: 900, transform: `translate(-50%, ${(1 - p) * 60}px)`, opacity: Math.min(1, p), display: "flex", alignItems: "center", gap: 14, padding: "16px 26px", borderRadius: 18, background: C.ink, color: "#fff", fontFamily: FONT.sans, fontSize: 22, fontWeight: 600, boxShadow: "0 24px 50px -20px rgb(0 0 0 / 0.5)", zIndex: 60 }}>
      <span style={{ width: 34, height: 34, borderRadius: 34, background: C.lime, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="check" size={20} color={C.ink} strokeWidth={3} />
      </span>
      Siparişin oluşturuldu · <span style={{ color: C.lime, fontWeight: 800 }}>AL-2610-7K2QX</span>
    </div>
  );
}
