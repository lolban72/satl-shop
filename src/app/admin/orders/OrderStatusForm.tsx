"use client";

import { useMemo, useState } from "react";
import {
  STATUS_META,
  STATUS_ORDER,
  ALLOWED_TRANSITIONS,
  type OrderStatus,
} from "@/lib/order-status";

export default function OrderStatusForm(props: {
  orderId: string;
  initialStatus: string;
}) {
  const initial = props.initialStatus as OrderStatus;

  const [status, setStatus] = useState<OrderStatus>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const allowed = useMemo(() => {
    // текущий статус всегда можно оставить как есть
    const next = new Set<OrderStatus>([status, ...(ALLOWED_TRANSITIONS[status] ?? [])]);
    return STATUS_ORDER.filter((s) => next.has(s));
  }, [status]);

  async function save() {
    setErr(null);
    setOk(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${props.orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Не удалось обновить статус");
      setOk("Сохранено ✅");
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setSaving(false);
      setTimeout(() => setOk(null), 1500);
    }
  }

  return (
    <div className="rounded-2xl border p-4">
      <div className="text-sm font-semibold">Статус заказа</div>

      <div className="mt-3 flex items-center gap-2">
        <span
          className={[
            "inline-flex items-center rounded-full border px-2 py-1 text-[12px] font-semibold",
            STATUS_META[status].badgeClass,
          ].join(" ")}
        >
          {STATUS_META[status].label}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus)}
          className="h-9 rounded-xl border px-3 text-sm"
        >
          {allowed.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>

        <button
          onClick={save}
          disabled={saving}
          className="h-9 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
      </div>

      <div className="mt-2 text-[12px] text-black/50">
        Разрешённые переходы:{" "}
        {(ALLOWED_TRANSITIONS[status] ?? [])
          .map((s) => STATUS_META[s].label)
          .join(", ") || "—"}
      </div>

      {err ? <div className="mt-2 text-sm text-red-600">{err}</div> : null}
      {ok ? <div className="mt-2 text-sm text-green-600">{ok}</div> : null}
    </div>
  );
}