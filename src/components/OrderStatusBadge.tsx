import { STATUS_META, type OrderStatus } from "@/lib/order-status";

export default function OrderStatusBadge({
  status,
}: {
  status: OrderStatus;
}) {
  const meta = STATUS_META[status];

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold",
        meta.badgeClass,
      ].join(" ")}
    >
      {meta.label}
    </span>
  );
}