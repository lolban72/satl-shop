"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-store";

export default function PaySuccessClient({ draftId }: { draftId: string }) {
  const [status, setStatus] = useState<string>("PENDING");
  const router = useRouter();
  const clear = useCart((s) => s.clear);

  useEffect(() => {
    let alive = true;
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // ~2 минуты (60 * 2сек)

    async function tick() {
      try {
        const res = await fetch(
          "/api/pay/status?draftId=" + encodeURIComponent(draftId),
          { cache: "no-store" }
        );

        const data = await res.json().catch(() => ({}));
        if (!alive) return;

        const newStatus = String(data?.status || "PENDING");
        setStatus(newStatus);

        if (newStatus === "PAID") {
          // ✅ останавливаем polling
          alive = false;

          // очищаем корзину
          clear();

          // редиректим (можно поменять маршрут)
          router.replace("/account/orders");
          return;
        }

        attempts++;
        if (attempts >= MAX_ATTEMPTS) {
          // если слишком долго ждём — прекращаем
          alive = false;
        }
      } catch {
        // просто пробуем снова
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
      <div className="mt-2 text-[12px] text-black/60 font-mono">
        {draftId}
      </div>

      <div className="mt-6 rounded-2xl border p-4 text-[14px]">
        {status === "PAID"
          ? "Заказ создан ✅"
          : "Создаём заказ… (ожидаем подтверждение)"}
      </div>

      <div className="mt-6">
        <Link href="/account/orders" className="text-[12px] underline">
          Перейти к заказам
        </Link>
      </div>
    </div>
  );
}