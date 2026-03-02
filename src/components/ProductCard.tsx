"use client";

import Link from "next/link";

type Props = {
  slug: string;
  title: string;

  // цена БЕЗ скидки (как в админке)
  price: number;

  // цена СО скидкой (как в админке)
  discountPrice?: number | null;

  imageUrl?: string | null;
  isSoon?: boolean;

  // ТОЛЬКО ДЛЯ ПЛАШКИ. На цену НЕ влияет.
  discountPercent?: number;
};

function rub(v: number) {
  // если у тебя цена в копейках:
  return (Number(v ?? 0) / 100).toFixed(0) + "р";
}

export default function ProductCard({
  slug,
  title,
  price,
  discountPrice,
  imageUrl,
  isSoon,
  discountPercent = 0,
}: Props) {
  const base = Number(price ?? 0);
  const disc = discountPrice == null ? null : Number(discountPrice);

  const hasDiscount = disc != null && disc > 0 && disc < base;

  const openPrice = hasDiscount ? disc! : base;
  const oldPrice = hasDiscount ? base : null;

  return (
    <Link
      href={`/product/${encodeURIComponent(slug)}`}
      className="block w-full max-w-[320px]"
    >
      <div className="relative w-full">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[18px] bg-black/5">
          {/* картинка */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl ?? "https://picsum.photos/seed/product/600/800"}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
          />

          {/* SOON */}
          {isSoon ? (
            <div className="absolute left-[10px] top-[10px] rounded-full bg-black/75 px-3 py-1 text-[11px] text-white">
              SOON
            </div>
          ) : null}

          {/* Плашка скидки — ТОЛЬКО визуально */}
          {hasDiscount && discountPercent > 0 ? (
            <div className="absolute right-[10px] top-[10px] rounded-full bg-[#B60404] px-3 py-1 text-[11px] font-bold text-white">
              -{discountPercent}%
            </div>
          ) : null}
        </div>

        {/* title + price */}
        <div className="mt-3">
          <div className="text-[13px] md:text-[14px] leading-[1.2] text-black">
            {title}
          </div>

          <div className="mt-2 flex items-end gap-2">
            {/* открытая цена */}
            <div className="text-[14px] md:text-[16px]">
              {rub(openPrice)}
            </div>

            {/* зачёркнутая старая */}
            {oldPrice != null ? (
              <div className="text-[12px] md:text-[13px] text-black/40 line-through">
                {rub(oldPrice)}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}