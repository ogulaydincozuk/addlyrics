/** Sunucu eylemlerinin form durum tipi (useActionState ile kullanılır). */
export type ActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Gönderilen değerler — hata durumunda formu yeniden doldurmak için */
  values?: Record<string, string>;
};

export const initialActionState: ActionState = { ok: false };

export function formValues(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}
