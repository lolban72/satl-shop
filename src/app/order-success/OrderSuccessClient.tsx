"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart-store";

export default function OrderSuccessClient({ orderId }: { orderId?: string }) {
  const clear = useCart((s) => s.clear);

  useEffect(() => {
    if (!orderId) return;

    // защита от повторной очистки при перезагрузке страницы
    const key = "satl_last_cleared_order";
    const last = localStorage.getItem(key);
    if (last === orderId) return;

    clear();
    localStorage.setItem(key, orderId);
  }, [orderId, clear]);

  return null;
}