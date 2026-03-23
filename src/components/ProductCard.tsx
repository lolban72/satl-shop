"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function ProductCard({
  slug,
  title,
  price,
  discountPrice = null,
  imageUrl,
  images = [],
  isSoon = false,
  discountPercent = 0,
  isSoldOut = false,
}: {
  slug: string;
  title: string;
  price: number;
  discountPrice?: number | null;
  imageUrl?: string | null;
  images?: string[];
  isSoon?: boolean;
  discountPercent?: number;
  isSoldOut?: boolean;
}) {
  const gallery = useMemo(() => {
    const list = (images ?? []).filter(Boolean);
    if (list.length > 0) return list;
    return [imageUrl ?? "https://picsum.photos/seed/product/800/600"];
  }, [images, imageUrl]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const basePrice = Number(price ?? 0);
  const discPrice = discountPrice == null ? null : Number(discountPrice ?? 0);

  const hasDiscount =
    !isSoon &&
    !isSoldOut &&
    discPrice != null &&
    discPrice > 0 &&
    discPrice < basePrice;

  const showDiscountBadge = hasDiscount && (discountPercent ?? 0) > 0;

  const oldPrice = basePrice;
  const finalPrice = hasDiscount ? (discPrice as number) : basePrice;

  const hasManyImages = gallery.length > 1;
  const currentImage = gallery[currentIndex] ?? gallery[0];

  function goPrev(e?: React.MouseEvent) {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? gallery.length - 1 : prev - 1));
    setZoom(1);
  }

  function goNext(e?: React.MouseEvent) {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev === gallery.length - 1 ? 0 : prev + 1));
    setZoom(1);
  }

  function openLightbox(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setZoom(1);
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
    setZoom(1);
  }

  function zoomIn(e?: React.MouseEvent) {
    e?.stopPropagation();
    setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)));
  }

  function zoomOut(e?: React.MouseEvent) {
    e?.stopPropagation();
    setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)));
  }

  useEffect(() => {
    if (!lightboxOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft" && hasManyImages) {
        setCurrentIndex((prev) => (prev === 0 ? gallery.length - 1 : prev - 1));
        setZoom(1);
      }
      if (e.key === "ArrowRight" && hasManyImages) {
        setCurrentIndex((prev) => (prev === gallery.length - 1 ? 0 : prev + 1));
        setZoom(1);
      }
      if (e.key === "+" || e.key === "=") {
        setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)));
      }
      if (e.key === "-") {
        setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)));
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [lightboxOpen, gallery.length, hasManyImages]);

  return (
    <>
      <div
        className="
          relative block text-center overflow-visible
          w-full md:w-[400px]
        "
      >
        {showDiscountBadge && (
          <div className="absolute right-[8px] md:right-[18px] top-[5px] md:top-[-28px] z-30 pointer-events-none">
            <span
              className="text-[15px] md:text-[20px] leading-none"
              style={{ fontFamily: "Yeast", fontWeight: 300, color: "#B60404" }}
            >
              -{discountPercent}
            </span>
            <span
              className="text-[12px] md:text-[16px] leading-none"
              style={{
                fontFamily: "YrsaBold",
                fontWeight: 700,
                color: "#B60404",
                marginLeft: "1px",
              }}
            >
              %
            </span>
          </div>
        )}

        <div
          className="
            relative mx-auto
            w-[100%] sm:w-full md:w-[400px]
            aspect-[0.9/1] sm:aspect-[4/3]
            md:h-[300px]
          "
        >
          {!isSoon && (
            <div
              className="
                absolute inset-0
                rounded-[28px] sm:rounded-[40px] md:rounded-[60px]
                opacity-60 md:opacity-70
                blur-[20px] sm:blur-[22px] md:blur-[38px]
              "
              style={{ backgroundColor: "#929292" }}
              aria-hidden="true"
            />
          )}

          <button
            type="button"
            onClick={openLightbox}
            className="absolute inset-0 z-20"
            aria-label={`Открыть фото товара ${title}`}
          >
            {/* MOBILE IMAGE */}
            <div className="md:hidden absolute inset-0 z-10">
              <div className="absolute inset-0 rounded-[28px] sm:rounded-[40px]" />
              <div className="absolute inset-0 z-20 p-[18px] overflow-visible">
                <img
                  src={currentImage}
                  alt={title}
                  className="h-full w-full object-contain scale-[1.35]"
                  draggable={false}
                />
              </div>
            </div>

            {/* DESKTOP IMAGE */}
            <div className="hidden md:block absolute inset-0 z-10 overflow-hidden rounded-[60px]">
              <img
                src={currentImage}
                alt={title}
                className="h-full w-full object-contain"
                draggable={false}
              />
            </div>
          </button>

          {!isSoon && hasManyImages && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="
                  absolute left-2 md:left-3 top-1/2 -translate-y-1/2 z-30
                  h-8 w-8 md:h-9 md:w-9
                  rounded-full border border-white/60 bg-black/25 text-white
                  backdrop-blur-sm
                  flex items-center justify-center
                "
                aria-label="Предыдущее фото"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={goNext}
                className="
                  absolute right-2 md:right-3 top-1/2 -translate-y-1/2 z-30
                  h-8 w-8 md:h-9 md:w-9
                  rounded-full border border-white/60 bg-black/25 text-white
                  backdrop-blur-sm
                  flex items-center justify-center
                "
                aria-label="Следующее фото"
              >
                ›
              </button>

              <div className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2 flex items-center gap-1">
                {gallery.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentIndex(i);
                      setZoom(1);
                    }}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentIndex ? "w-5 bg-white" : "w-1.5 bg-white/50"
                    }`}
                    aria-label={`Открыть фото ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}

          {!isSoon && (
            <div className="absolute right-2 bottom-2 z-30 rounded-full border border-white/60 bg-black/25 px-2 py-1 text-[10px] md:text-[11px] text-white backdrop-blur-sm">
              Нажми, чтобы увеличить
            </div>
          )}

          {isSoon && (
            <div className="absolute inset-0 z-20">
              <div
                className="
                  absolute inset-0
                  rounded-[24px] sm:rounded-[34px] md:rounded-[50px]
                  bg-black/15 backdrop-blur-[22px] md:backdrop-blur-[28px]
                "
              />
              <div className="absolute inset-0 grid place-items-center">
                <div
                  className="text-[34px] sm:text-[40px] md:text-[64px] tracking-[-0.02em] text-white uppercase"
                  style={{
                    fontFamily: "Montserrat",
                    fontWeight: 800,
                    textShadow: "0 6px 12px rgba(0,0,0,0.6)",
                    WebkitTextStroke: "3px rgb(255, 255, 255)",
                  }}
                >
                  СКОРО
                </div>
              </div>
            </div>
          )}
        </div>

        {!isSoon && (
          <div className="mt-[-5px] md:mt-5">
            <Link href={`/product/${slug}`} className="block">
              <div
                className="text-[18px] sm:text-[20px] md:text-[30px] leading-none"
                style={{ fontFamily: "Yeast" }}
              >
                {title}
              </div>
            </Link>

            {isSoldOut ? (
              <div
                className="mt-2 text-[18px] md:text-[25px] leading-none uppercase text-black/70"
                style={{ fontFamily: "Yeast" }}
              >
                Sold out
              </div>
            ) : hasDiscount ? (
              <div className="mt-2 flex items-baseline justify-center gap-2 md:gap-3">
                <div
                  className="text-[14px] md:text-[18px] leading-none opacity-70 line-through"
                  style={{ fontFamily: "Yeast" }}
                >
                  {(oldPrice / 100).toFixed(0)}р
                </div>

                <div
                  className="text-[18px] md:text-[25px] leading-none"
                  style={{ fontFamily: "Yeast" }}
                >
                  {(finalPrice / 100).toFixed(0)}р
                </div>
              </div>
            ) : (
              <div
                className="mt-2 text-[18px] md:text-[25px] leading-none"
                style={{ fontFamily: "Yeast" }}
              >
                {(basePrice / 100).toFixed(0)}р
              </div>
            )}
          </div>
        )}
      </div>

      {lightboxOpen && !isSoon && (
        <div
          className="fixed inset-0 z-[999] bg-black/92"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
            className="
              absolute right-4 top-4 z-[1001]
              h-11 w-11 rounded-full border border-white/30
              bg-white/10 text-white text-xl
              backdrop-blur-sm
            "
            aria-label="Закрыть"
          >
            ✕
          </button>

          <div className="absolute left-4 top-4 z-[1001] flex items-center gap-2">
            <button
              type="button"
              onClick={zoomOut}
              className="
                h-11 w-11 rounded-full border border-white/30
                bg-white/10 text-white text-xl backdrop-blur-sm
              "
              aria-label="Уменьшить"
            >
              −
            </button>

            <button
              type="button"
              onClick={zoomIn}
              className="
                h-11 w-11 rounded-full border border-white/30
                bg-white/10 text-white text-xl backdrop-blur-sm
              "
              aria-label="Увеличить"
            >
              +
            </button>

            <div className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm text-white backdrop-blur-sm">
              {Math.round(zoom * 100)}%
            </div>
          </div>

          {hasManyImages && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="
                  absolute left-4 top-1/2 z-[1001] -translate-y-1/2
                  h-12 w-12 rounded-full border border-white/30
                  bg-white/10 text-white text-2xl backdrop-blur-sm
                "
                aria-label="Предыдущее фото"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={goNext}
                className="
                  absolute right-4 top-1/2 z-[1001] -translate-y-1/2
                  h-12 w-12 rounded-full border border-white/30
                  bg-white/10 text-white text-2xl backdrop-blur-sm
                "
                aria-label="Следующее фото"
              >
                ›
              </button>
            </>
          )}

          <div
            className="absolute inset-0 flex items-center justify-center overflow-auto p-6 md:p-12"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => {
              e.preventDefault();
              if (e.deltaY < 0) {
                setZoom((z) => Math.min(4, +(z + 0.15).toFixed(2)));
              } else {
                setZoom((z) => Math.max(1, +(z - 0.15).toFixed(2)));
              }
            }}
          >
            <img
              src={currentImage}
              alt={title}
              draggable={false}
              onDoubleClick={() =>
                setZoom((z) => (z > 1 ? 1 : 2))
              }
              className="max-h-none max-w-none select-none object-contain transition-transform duration-200"
              style={{
                transform: `scale(${zoom})`,
                maxWidth: "85vw",
                maxHeight: "85vh",
                cursor: zoom > 1 ? "zoom-out" : "zoom-in",
              }}
            />
          </div>

          {hasManyImages && (
            <div className="absolute bottom-5 left-1/2 z-[1001] flex -translate-x-1/2 items-center gap-2">
              {gallery.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(i);
                    setZoom(1);
                  }}
                  className={`overflow-hidden rounded-lg border ${
                    i === currentIndex
                      ? "border-white"
                      : "border-white/20 opacity-70"
                  }`}
                  aria-label={`Открыть фото ${i + 1}`}
                >
                  <img
                    src={src}
                    alt={`${title}-${i}`}
                    className="h-12 w-12 object-cover"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}