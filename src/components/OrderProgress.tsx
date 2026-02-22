import { type OrderStatus } from "@/lib/order-status";

const FLOW: OrderStatus[] = [
  "NEW",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

const LABELS: Record<OrderStatus, string> = {
  NEW: "Новый",
  PROCESSING: "В обработке",
  SHIPPED: "В доставке",
  DELIVERED: "Доставлен",
  CANCELED: "Отменён",
  RETURNED: "Возврат",
};

export default function OrderProgress({ status }: { status: OrderStatus }) {
  const currentIndex = FLOW.indexOf(status);

  if (status === "CANCELED") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Заказ отменён
      </div>
    );
  }

  if (status === "RETURNED") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Товар возвращён
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      {FLOW.map((step, i) => {
        const done = i <= currentIndex;
        return (
          <div key={step} className="flex flex-1 flex-col items-center">
            <div
              className={[
                "h-3 w-3 rounded-full",
                done ? "bg-black" : "bg-black/20",
              ].join(" ")}
            />
            <div className="mt-2 text-[11px] text-black/70 text-center">
              {LABELS[step]}
            </div>
          </div>
        );
      })}
    </div>
  );
}