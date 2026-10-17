import "server-only";
import { appUrl } from "../env";
import type { EmailMessage } from "./index";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

type Layout = { heading: string; paragraphs: string[]; cta?: { label: string; href: string }; footnote?: string };

/** Sade, açık renkli ve tüm e-posta istemcilerinde okunabilir şablon. */
export function renderEmail(to: string, subject: string, layout: Layout): EmailMessage {
  const ctaUrl = layout.cta ? (layout.cta.href.startsWith("http") ? layout.cta.href : appUrl(layout.cta.href)) : null;
  const text = [
    layout.heading,
    "",
    ...layout.paragraphs,
    ctaUrl ? `\n${layout.cta!.label}: ${ctaUrl}` : "",
    layout.footnote ? `\n${layout.footnote}` : "",
    "\n— AddLyrics",
  ].join("\n");

  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;color:#172033">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px">
<tr><td style="padding:28px 32px 8px"><span style="display:inline-block;background:#000000;border-radius:8px;padding:6px 10px;font-size:18px;line-height:1"><span style="font-weight:900;color:#FFFFFF;letter-spacing:-0.5px">Add</span><span style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:700;color:#DFFF4C">Lyrics</span></span></td></tr>
<tr><td style="padding:8px 32px 28px">
<h1 style="font-size:20px;line-height:28px;margin:0 0 12px">${escapeHtml(layout.heading)}</h1>
${layout.paragraphs.map((p) => `<p style="font-size:15px;line-height:24px;margin:0 0 12px;color:#334155">${escapeHtml(p)}</p>`).join("")}
${ctaUrl ? `<p style="margin:20px 0 4px"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#DFFF4C;color:#172033;text-decoration:none;font-weight:700;font-size:15px;padding:12px 20px;border-radius:10px;border:1px solid #C4E534">${escapeHtml(layout.cta!.label)}</a></p>` : ""}
${layout.footnote ? `<p style="font-size:13px;line-height:20px;color:#64748B;margin:20px 0 0">${escapeHtml(layout.footnote)}</p>` : ""}
</td></tr></table>
<p style="font-size:12px;color:#94A3B8;margin:16px 0 0">Bu e-posta AddLyrics hesabınla ilgili bir işlem nedeniyle gönderildi.</p>
</td></tr></table></body></html>`;

  return { to, subject, text, html };
}
