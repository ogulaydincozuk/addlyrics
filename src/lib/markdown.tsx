import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Admin panelinden girilen içerik sayfaları için sınırlı ve güvenli markdown.
 * HTML hiçbir zaman ham olarak basılmaz; yalnızca şu yapılar React öğelerine çevrilir:
 *   ## Başlık, ### Alt başlık, - liste, > not, **kalın**, [metin](https://… veya /yol)
 */
export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="prose-al">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("### ")) return <h3 key={i}>{inline(trimmed.slice(4))}</h3>;
        if (trimmed.startsWith("## ")) return <h2 key={i}>{inline(trimmed.slice(3))}</h2>;
        if (trimmed.startsWith("# ")) return <h2 key={i}>{inline(trimmed.slice(2))}</h2>;
        const lines = trimmed.split("\n");
        if (lines.every((l) => l.trim().startsWith("- "))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.trim().slice(2))}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => l.trim().startsWith(">"))) {
          return <blockquote key={i}>{inline(lines.map((l) => l.trim().replace(/^>\s?/, "")).join(" "))}</blockquote>;
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function safeHref(href: string) {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (/^https:\/\//i.test(href) || /^mailto:/i.test(href)) return href;
  return null;
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = pattern.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      out.push(<strong key={key++}>{m[1]}</strong>);
    } else {
      const href = safeHref(m[3]!);
      if (!href) out.push(m[2]);
      else if (href.startsWith("/")) out.push(<Link key={key++} href={href}>{m[2]}</Link>);
      else out.push(<a key={key++} href={href} rel="noopener noreferrer" target="_blank">{m[2]}</a>);
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
