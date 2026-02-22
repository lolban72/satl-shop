export type OrderStatus =
  | "NEW"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELED"
  | "RETURNED";

type Meta = { label: string; badgeClass: string };

const BASE =
  "inline-flex items-center rounded-full border px-3 py-[6px] text-[11px] md:text-[12px] font-semibold uppercase tracking-[0.08em]";

export const STATUS_META: Record<OrderStatus, Meta> = {
  NEW: {
    label: "Новый",
    badgeClass: [
      BASE,
      "border-black/15 bg-white text-black/70",
    ].join(" "),
  },

  PROCESSING: {
    label: "В обработке",
    badgeClass: [
      BASE,
      "border-black/20 bg-black/[0.03] text-black/80",
    ].join(" "),
  },

  SHIPPED: {
    label: "В доставке",
    badgeClass: [
      BASE,
      "border-black/20 bg-black/[0.06] text-black",
    ].join(" "),
  },

  DELIVERED: {
    label: "Доставлен",
    badgeClass: [
      BASE,
      "border-black bg-black text-white",
    ].join(" "),
  },

  CANCELED: {
    label: "Отменён",
    badgeClass: [
      BASE,
      "border-red-300/70 bg-red-50 text-red-700",
    ].join(" "),
  },

  RETURNED: {
    label: "Возврат",
    badgeClass: [
      BASE,
      "border-amber-300/70 bg-amber-50 text-amber-800",
    ].join(" "),
  },
};

export const STATUS_ORDER: OrderStatus[] = [
  "NEW",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELED",
  "RETURNED",
];

// Разрешённые переходы (чтобы не было “магии”)
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["PROCESSING", "CANCELED"],
  PROCESSING: ["SHIPPED", "CANCELED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["RETURNED"],
  CANCELED: [],
  RETURNED: [],
};

export function isAllowedTransition(from: OrderStatus, to: OrderStatus) {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}