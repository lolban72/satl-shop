"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-store";

export default function PaySuccessClient({ draftId }: { draftId: string }) {
  const [status, setStatus] = useState<string>("PENDING");
  const [orderId, setOrderId] = useState<string | null>(null);

  const router = useRouter();
  const clear = useCart((s) => s.clear);

  useEffect(() => {
    let alive = true;
    let attempts = 0;
    const MAX_ATTEMPTS = 90; // ~3 минуты (90 * 2сек)

    async function tick() {
      try {
        const res = await fetch(
          "/api/pay/status?draftId=" + encodeURIComponent(draftId),
          { cache: "no-store" }
        );

        const data = await res.json().catch(() => ({}));
        if (!alive) return;

        const newStatus = String(data?.status || "PENDING");
        const newOrderId = data?.orderId ? String(data.orderId) : null;

        setStatus(newStatus);
        setOrderId(newOrderId);

        // ✅ редиректим только когда реально есть заказ
        if (newStatus === "PAID" && newOrderId) {
          alive = false;
          clear();
          router.replace("/account/orders");
          return;
        }

        attempts++;
        if (attempts >= MAX_ATTEMPTS) alive = false;
      } catch {
        // молча пробуем снова
      }
    }

    tick();
    const interval = setInterval(tick, 2000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [draftId, router, clear]);

  return (
    <div className="mx-auto max-w-[520px] px-4 py-10">
      <div className="text-[22px] font-semibold">Оплата принята</div>
      <div className="mt-2 text-[12px] text-black/60 font-mono">{draftId}</div>

      <div className="mt-6 rounded-2xl border p-4 text-[14px]">
        {status === "PAID" && orderId
          ? "Заказ создан ✅"
          : "Создаём заказ… (ожидаем подтверждение)"}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <Link href="/account/orders" className="text-[12px] underline">
          Перейти к заказам
        </Link>

        {orderId ? (
          <Link
            href={`/admin/orders/${orderId}`}
            className="text-[12px] underline text-black/60 hover:text-black transition"
          >
            Открыть заказ (админ)
          </Link>
        ) : null}
      </div>
    </div>
  );
}