"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-store";

export default function CartIndicator() {
  const items = useCart((s) => s.items);
  const count = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <Link href="/cart" className="relative">
      Корзина
      {count > 0 && (
        <span className="ml-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-black px-1.5 text-xs text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
