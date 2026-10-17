/**
 * Sipariş mesajlaşması OrderEvent kayıtlarıyla tutulur:
 *   CUSTOMER_MESSAGE — müşteriden ekibe, NOTE — ekipten müşteriye (soru/yanıt),
 *   MESSAGE_HANDLED — iç işaret: son müşteri mesajı yanıt gerektirmiyor (ör. teşekkür).
 */
export const MESSAGE_EVENT_TYPES = ["CUSTOMER_MESSAGE", "NOTE", "MESSAGE_HANDLED"] as const;
export const VISIBLE_MESSAGE_TYPES = ["CUSTOMER_MESSAGE", "NOTE"] as const;

export type MessageThreadState = "AWAITING_REPLY" | "REPLIED" | "HANDLED";

/** Konuşmanın durumu en son mesajlaşma olayına göre belirlenir: son söz müşterideyse ekip yanıtı beklenir. */
export function messageThreadState(latestType: string | null | undefined): MessageThreadState | null {
  if (latestType === "CUSTOMER_MESSAGE") return "AWAITING_REPLY";
  if (latestType === "NOTE") return "REPLIED";
  if (latestType === "MESSAGE_HANDLED") return "HANDLED";
  return null;
}

export const MESSAGE_THREAD_LABELS: Record<MessageThreadState, string> = {
  AWAITING_REPLY: "Yanıt bekliyor",
  REPLIED: "Yanıtlandı",
  HANDLED: "Yanıt gerekmiyor",
};

export const MESSAGE_THREAD_TONES = {
  AWAITING_REPLY: "warning",
  REPLIED: "success",
  HANDLED: "neutral",
} as const satisfies Record<MessageThreadState, string>;
