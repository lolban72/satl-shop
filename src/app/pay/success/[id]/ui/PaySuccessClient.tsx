"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PaySuccessClient({ draftId }: { draftId: string }) {
  const [status, setStatus] = useState<string>("PENDING");

  useEffect(() => {
    let alive = true;

    async function tick() {
      const res = await fetch("/api/pay/status?draftId=" + encodeURIComponent(draftId));
      const data = await res.json().catch(() => ({}));
      if (!alive) return;

      setStatus(String(data?.status || "PENDING"));

      if (data?.status === "PAID" && data?.orderId) {
        // можно редиректить в админку/заказы/конкретный заказ — как захочешь
        // например: window.location.href = "/account/orders";
      }
    }

    tick();
    const t = setInterval(tick, 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [draftId]);

  return (
    <div className="mx-auto max-w-[520px] px-4 py-10">
      <div className="text-[22px] font-semibold">Оплата принята</div>
      <div className="mt-2 text-[12px] text-black/60 font-mono">{draftId}</div>

      <div className="mt-6 rounded-2xl border p-4 text-[14px]">
        {status === "PAID" ? "Заказ создан ✅" : "Создаём заказ… (ожидаем подтверждение)"}
      </div>

      <div className="mt-6">
        <Link href="/account/orders" className="text-[12px] underline">
          Перейти к заказам
        </Link>
      </div>
    </div>
  );
}