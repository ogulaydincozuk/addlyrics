import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { fadeUp, pop } from "../anim";
import { Phone } from "../components/devices";
import { LyricMini, type LyricKind } from "../components/lyric-mini";
import { Icon, Kicker, Logo } from "../components/ui";
import { C, FONT, SHADOW } from "../theme";
import { AD_W, COL, SAFE } from "./safe";
import { VideoStrip } from "./strip";
import { VTitle } from "./v-info";

const PHONE_W = 470;
const THUMBS: LyricKind[] = ["film", "minimal", "clip", "film"];

export function VPanel({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const phone = Math.min(1, pop(frame, 0, 15, 120));
  const screenW = PHONE_W * 0.93;
  const thumbW = (screenW - 21 * 2 - 14) / 2;
  const team = Math.min(1, pop(frame, Math.round(duration * 0.3), 13, 170));
  const me = Math.min(1, pop(frame, Math.round(duration * 0.52), 13, 170));
  const chip = Math.min(1, pop(frame, Math.round(duration * 0.72), 13, 170));
  return (
    <AbsoluteFill>
      <VTitle kicker="Müşteri paneli" size={86}>
        Her şey
        <br />
        tek panelde.
      </VTitle>

      <div style={{ position: "absolute", left: (AD_W - PHONE_W) / 2 + 60, top: 590, opacity: phone, transform: `translateY(${(1 - phone) * 300}px) rotate(${(1 - phone) * 6 + 3}deg)` }}>
        <Phone width={PHONE_W}>
          <div style={{ position: "absolute", inset: 0, background: C.canvas, padding: "58px 21px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Logo size={20} />
              <Icon name="bell" size={24} color={C.inkSoft} />
            </div>
            <div style={{ marginTop: 18, fontFamily: FONT.display, fontWeight: 800, fontSize: 25, color: C.ink }}>Teslim Edilen Videolar</div>
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: `repeat(2, ${thumbW}px)`, gap: 14 }}>
              {THUMBS.map((k, i) => {
                const p = Math.min(1, pop(frame, 8 + i * 4, 14, 180));
                return (
                  <div key={i} style={{ width: thumbW, height: thumbW * 1.25, borderRadius: 14, overflow: "hidden", position: "relative", opacity: p, transform: `scale(${0.8 + p * 0.2})` }}>
                    <LyricMini kind={k} frame={frame + i * 25} w={thumbW} lineDur={46} badge={false} />
                    <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 0", borderRadius: 10, background: C.lime, fontFamily: FONT.sans, fontWeight: 800, fontSize: 16, color: C.ink }}>
                      <Icon name="download" size={16} color={C.ink} strokeWidth={2.6} /> İndir
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 18, padding: "14px 16px", borderRadius: 14, background: "#fff", border: `1.5px solid ${C.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT.sans, fontSize: 17, fontWeight: 700, color: C.inkSoft }}>
                <span>Kalan video hakkı</span>
                <span style={{ color: C.ink }}>75 / 105</span>
              </div>
              <div style={{ marginTop: 8, height: 8, borderRadius: 8, background: C.brandSoft }}>
                <div style={{ width: "71%", height: "100%", borderRadius: 8, background: C.brand }} />
              </div>
            </div>
          </div>
        </Phone>
      </div>

      <div style={{ position: "absolute", left: COL.left, top: 700, maxWidth: 560, opacity: team, transform: `translateY(${(1 - team) * 40}px) scale(${0.9 + team * 0.1})`, transformOrigin: "left bottom", zIndex: 3 }}>
        <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 26, color: C.brand, marginBottom: 8 }}>AddLyrics ekibi</div>
        <div style={{ padding: "22px 26px", borderRadius: "30px 30px 30px 8px", background: "#fff", border: `2px solid ${C.brandSoft}`, boxShadow: SHADOW.lift, fontFamily: FONT.sans, fontWeight: 600, fontSize: 36, lineHeight: 1.3, color: C.ink }}>
          Nakaratta hangi satır öne çıksın?
        </div>
      </div>
      <div style={{ position: "absolute", right: AD_W - SAFE.right, top: 900, maxWidth: 500, textAlign: "right", opacity: me, transform: `translateY(${(1 - me) * 40}px) scale(${0.9 + me * 0.1})`, transformOrigin: "right bottom", zIndex: 3 }}>
        <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 26, color: C.inkSoft, marginBottom: 8 }}>Sen</div>
        <div style={{ padding: "22px 26px", borderRadius: "30px 30px 8px 30px", background: C.lime, boxShadow: SHADOW.lift, fontFamily: FONT.sans, fontWeight: 700, fontSize: 36, lineHeight: 1.3, color: C.ink, textAlign: "left" }}>
          Son satır olsun, yazılar beyaz!
        </div>
      </div>
      <div style={{ position: "absolute", left: COL.left, width: COL.width, top: 1120, display: "flex", justifyContent: "center", opacity: chip, transform: `translateY(${(1 - chip) * 30}px)`, zIndex: 3 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "16px 26px", borderRadius: 99, background: C.ink, color: "#fff", fontFamily: FONT.sans, fontWeight: 700, fontSize: 32, boxShadow: SHADOW.lift }}>
          <Icon name="message-square-text" size={32} color={C.lime} />
          Üretimden önce sorularımızı sorarız
        </span>
      </div>
    </AbsoluteFill>
  );
}

export function VCta({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const logo = pop(frame, 0, 11, 150);
  const beat = Math.max(0, Math.sin((frame / 15) * Math.PI)) * 0.04;
  const glow = 0.8 + Math.sin(frame / 8) * 0.2;
  return (
    <AbsoluteFill>
      <VideoStrip offset={500} />
      <div style={{ position: "absolute", left: AD_W / 2 - 600, top: 300, width: 1200, height: 1200, borderRadius: "50%", background: `radial-gradient(circle, ${C.lime}77 0%, transparent 60%)`, opacity: glow }} />
      <div style={{ position: "absolute", left: COL.left, width: COL.width, top: SAFE.top + 10, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ transform: `scale(${logo})` }}>
          <Logo size={76} style={{ boxShadow: "0 30px 60px -24px rgb(0 0 0 / 0.55)" }} />
        </div>
        <div style={{ marginTop: 56, fontFamily: FONT.display, fontWeight: 800, fontSize: 92, lineHeight: 1.04, letterSpacing: "-0.035em", color: C.ink, ...fadeUp(frame, 4, 40, 10) }}>
          Şarkın İçin
          <br />
          İlk Paketini Seç.
        </div>
        <div style={{ marginTop: 26, fontFamily: FONT.sans, fontSize: 40, fontWeight: 500, color: C.inkSoft, ...fadeUp(frame, 8, 24, 10) }}>
          <b style={{ color: C.ink }}>₺3.200&apos;den</b> başlayan paketler
        </div>
        <div style={{ marginTop: 44, ...fadeUp(frame, 12, 30, 10) }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 16, padding: "30px 52px", borderRadius: 26, background: C.lime, boxShadow: "0 26px 50px -20px rgb(150 190 20 / 0.95)", fontFamily: FONT.sans, fontWeight: 800, fontSize: 50, color: C.ink, transform: `scale(${1 + beat})` }}>
            Paketleri İncele
            <Icon name="arrow-right" size={50} color={C.ink} strokeWidth={2.6} />
          </div>
        </div>
        <div style={{ marginTop: 34, display: "flex", flexDirection: "column", alignItems: "center", opacity: fadeUp(frame, 20, 10, 10).opacity }}>
          {[0, 1, 2].map((i) => {
            const phase = ((frame - i * 4) % 24) / 24;
            return <Icon key={i} name="chevron-down" size={64} color={C.brand} strokeWidth={3} style={{ marginTop: i ? -26 : 0, opacity: 0.25 + 0.75 * Math.max(0, Math.sin(phase * Math.PI)) }} />;
          })}
        </div>
        <div style={{ marginTop: 26, ...fadeUp(frame, 24, 20, 10) }}>
          <Kicker style={{ fontSize: 28, padding: "10px 22px" }}>Your Music. Your Lyrics. Your Visuals.</Kicker>
        </div>
      </div>
    </AbsoluteFill>
  );
}
