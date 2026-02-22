"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/lib/cart-store";
import Link from "next/link";

// порядок “классических” размеров (если попадутся другие — уйдут в конец и отсортируются по алфавиту)
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

function normalizeSize(s: any) {
  return String(s ?? "").trim().toUpperCase();
}

function sortVariantsBySize(variants: any[]) {
  return [...variants].sort((a, b) => {
    const as = normalizeSize(a?.size);
    const bs = normalizeSize(b?.size);

    const ai = SIZE_ORDER.indexOf(as);
    const bi = SIZE_ORDER.indexOf(bs);

    // оба в списке — сортируем по порядку
    if (ai !== -1 && bi !== -1) return ai - bi;

    // только один в списке — он выше
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;

    // если оба не в списке — попробуем числовую сортировку (42, 44, 46...)
    const an = Number(as);
    const bn = Number(bs);
    const aNum = Number.isFinite(an);
    const bNum = Number.isFinite(bn);
    if (aNum && bNum) return an - bn;
    if (aNum) return -1;
    if (bNum) return 1;

    // иначе — по алфавиту
    return as.localeCompare(bs);
  });
}

export default function AddToCart({
  productId,
  title,
  price,
  image,
  variants,
  cartHref = "/cart",
  sizeChartImage, // ✅ URL таблицы размеров
}: any) {
  const addItem = useCart((s) => s.addItem);

  // ✅ только реальные размеры товара, но отсортированные стабильно
  const safeVariants = useMemo(() => {
    const arr = Array.isArray(variants) ? variants : [];
    return sortVariantsBySize(arr);
  }, [variants]);

  // ✅ выбираем первый доступный размер (чтобы не было undefined и не выбирался “нет в наличии”)
  const firstAvailableSize = useMemo(() => {
    const hit = safeVariants.find((v: any) => (v?.stock ?? 0) > 0);
    return hit?.size;
  }, [safeVariants]);

  const [size, setSize] = useState(firstAvailableSize);

  // ✅ если variants загрузились позже / выбранный стал недоступен — синхронизируем
  useEffect(() => {
    if (!size && firstAvailableSize) setSize(firstAvailableSize);

    const current = safeVariants.find((v: any) => v?.size === size);
    const ok = current && (current.stock ?? 0) > 0;

    if (!ok && firstAvailableSize && size !== firstAvailableSize) {
      setSize(firstAvailableSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstAvailableSize, safeVariants]);

  const currentVariant = useMemo(() => {
    return safeVariants.find((v: any) => v.size === size) ?? safeVariants?.[0];
  }, [safeVariants, size]);

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);

  // ✅ Модалка таблицы размеров
  const [isSizeChartModalOpen, setIsSizeChartModalOpen] = useState(false);

  const imgSrc = useMemo(
    () => image ?? "https://picsum.photos/seed/product/240/240",
    [image]
  );

  function startAutoClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setClosing(true);
      window.setTimeout(() => {
        setOpen(false);
        setClosing(false);
      }, 220);
    }, 8000);
  }

  function openToast() {
    setOpen(true);
    setClosing(false);
    startAutoClose();
  }

  function closeToast() {
    if (!open) return;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 220);
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  function openSizeChartModal() {
    setIsSizeChartModalOpen(true);
  }

  function closeSizeChartModal() {
    setIsSizeChartModalOpen(false);
  }

  // ✅ ESC + блокировка скролла
  useEffect(() => {
    if (!isSizeChartModalOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSizeChartModal();
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isSizeChartModalOpen]);

  return (
    <div>
      {/* SIZES (только реальные размеры, но стабильный порядок) */}
      <div className="flex flex-wrap gap-[8px]" style={{ fontFamily: "Yeast" }}>
        {safeVariants.map((v: any) => {
          const isAvailable = (v?.stock ?? 0) > 0;

          return (
            <button
              key={v.id ?? `${v.size}-${v.color ?? "default"}`}
              onClick={() => {
                if (isAvailable) setSize(v.size);
              }}
              disabled={!isAvailable}
              className={[
                "flex items-center justify-center border font-bold",
                "h-[34px] w-[34px] text-[18px] md:h-[36px] md:w-[36px] md:text-[20px]",
                size === v.size ? "bg-black text-white" : "bg-white text-black",
                !isAvailable
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:bg-black hover:text-white transition",
              ].join(" ")}
              type="button"
              title={!isAvailable ? "Нет в наличии" : ""}
            >
              <div className="mt-[2px]">{v.size}</div>
            </button>
          );
        })}
      </div>

      {/* SIZE CHART LINK */}
      <div className="mt-[6px] text-[10px] text-black/45">
        <button
          type="button"
          onClick={openSizeChartModal}
          className="underline text-black/70 hover:text-black transition"
        >
          Таблица размеров
        </button>
      </div>

      {/* BUTTON */}
      <button
        className="
          mt-[14px] md:mt-[16px]
          w-full bg-black text-white uppercase
          h-[46px] md:h-[50px]
          text-[16px] md:text-[20px]
          tracking-[-0.05em]
        "
        style={{ fontFamily: "Brygada" }}
        onClick={() => {
          addItem({
            productId,
            variantId: currentVariant?.id,
            size: currentVariant?.size,
            title,
            price,
            image,
            qty: 1,
          });
          openToast();
        }}
        type="button"
        disabled={!currentVariant || (currentVariant.stock ?? 0) <= 0}
      >
        ДОБАВИТЬ В КОРЗИНУ
      </button>

      {/* TOAST */}
      {open ? (
        <div
          className={[
            "fixed z-[9999]",
            "left-1/2 -translate-x-1/2 bottom-[18px]",
            "md:left-auto md:translate-x-0 md:bottom-[26px] md:right-[26px]",
            "transition-[opacity,transform] duration-200 ease-out",
            closing
              ? "opacity-0 translate-y-[10px]"
              : "opacity-100 translate-y-0",
          ].join(" ")}
        >
          <div
            className="relative bg-white border border-black/60 w-[calc(100vw-28px)] max-w-[520px] md:w-[520px]"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}
            onMouseEnter={() => {
              if (closeTimer.current) window.clearTimeout(closeTimer.current);
            }}
            onMouseLeave={() => {
              startAutoClose();
            }}
          >
            <button
              type="button"
              onClick={closeToast}
              aria-label="Закрыть"
              className="absolute right-[12px] md:right-[16px] top-[12px] md:top-[14px] text-black/70 hover:text-black transition"
              style={{ fontSize: 22, lineHeight: 1 }}
            >
              ×
            </button>

            <div className="flex items-center gap-[14px] md:gap-[30px] px-[12px] md:px-[15px] py-[10px]">
              <div className="h-[92px] w-[92px] md:h-[150px] md:w-[150px] flex items-center justify-center md:mr-[20px] md:ml-[20px] shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc}
                  alt={title}
                  className="h-full w-full object-contain"
                  draggable={false}
                />
              </div>

              <div className="min-w-0">
                <div
                  className="text-[12px] md:text-[14px] uppercase truncate"
                  style={{ fontFamily: "Brygada", fontWeight: 700 }}
                  title={String(title ?? "").toUpperCase()}
                >
                  {String(title ?? "").toUpperCase()}
                </div>

                <div
                  className="mt-[4px] text-[12px] md:text-[13px]"
                  style={{ fontFamily: "Brygada", fontWeight: 700 }}
                >
                  УЖЕ В КОРЗИНЕ
                </div>

                <Link
                  href={cartHref}
                  className="mt-[10px] md:mt-[14px] inline-flex items-center justify-center bg-black text-white uppercase h-[40px] md:h-[42px] w-[220px] md:w-[260px]"
                  style={{
                    fontFamily: "Brygada",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                  onClick={closeToast}
                >
                  ОФОРМИТЬ ЗАКАЗ
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ✅ SIZE CHART MODAL */}
      {isSizeChartModalOpen ? (
        <div
          className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center px-[14px]"
          onClick={closeSizeChartModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative bg-white border border-black/20 w-full max-w-[780px] max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}
          >
            <button
              type="button"
              onClick={closeSizeChartModal}
              aria-label="Закрыть"
              className="absolute right-[12px] top-[10px] text-black/70 hover:text-black transition"
              style={{ fontSize: 26, lineHeight: 1 }}
            >
              ×
            </button>

            <div className="p-[14px] md:p-[18px] pt-[40px]">
              {sizeChartImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sizeChartImage}
                  alt="Таблица размеров"
                  className="w-full h-auto object-contain"
                />
              ) : (
                <div className="text-[13px] text-black/60">
                  Таблица размеров для этого товара не добавлена.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}