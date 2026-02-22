"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function ProductGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const safe = useMemo(() => (images?.length ? images.filter(Boolean) : []), [images]);
  const [active, setActive] = useState(0);
  const activeSrc = safe[active] ?? safe[0];

  const [displaySrc, setDisplaySrc] = useState(activeSrc);
  const [fade, setFade] = useState(false);

  const thumbsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeSrc) return;
    if (activeSrc === displaySrc) return;

    setFade(true);
    const t = window.setTimeout(() => {
      setDisplaySrc(activeSrc);
      setFade(false);
    }, 160);

    return () => window.clearTimeout(t);
  }, [activeSrc, displaySrc]);

  useEffect(() => {
    const el = thumbsRef.current;
    if (!el) return;

    let raf = 0;
    let target = el.scrollTop;

    const animate = () => {
      const current = el.scrollTop;
      const next = current + (target - current) * 0.18;
      el.scrollTop = next;

      if (Math.abs(target - next) > 0.5) {
        raf = requestAnimationFrame(animate);
      } else {
        el.scrollTop = target;
        raf = 0;
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      target += e.deltaY;

      const max = el.scrollHeight - el.clientHeight;
      if (target < 0) target = 0;
      if (target > max) target = max;

      if (!raf) raf = requestAnimationFrame(animate);
    };

    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel as any);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  function scrollThumbIntoView(idx: number) {
    const root = thumbsRef.current;
    if (!root) return;
    const btn = root.querySelector<HTMLButtonElement>(`button[data-idx="${idx}"]`);
    if (!btn) return;
    btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }

  if (!safe.length) return null;

  return (
    <div className="flex flex-col md:flex-row items-start gap-[14px] sm:gap-[18px] md:gap-[24px]">
      {/* MAIN IMAGE */}
      <div className="relative w-full md:w-auto order-1 md:order-2">
        <div className="relative h-[360px] sm:h-[440px] w-full md:h-[580px] md:w-[680px]">
          <div
            className="
              pointer-events-none absolute left-1/2 top-1/2
              h-[260px] w-[320px]
              sm:h-[320px] sm:w-[420px]
              md:h-[430px] md:w-[560px]
              -translate-x-1/2 -translate-y-1/2
              blur-[45px] md:blur-[55px]
              opacity-55
            "
            style={{ backgroundColor: "#9B9B9B" }}
            aria-hidden="true"
          />

          <div className="absolute inset-0">
            <img
              src={displaySrc}
              alt={title}
              className="h-full w-full object-contain"
              draggable={false}
              style={{
                opacity: fade ? 0 : 1,
                transform: fade ? "scale(0.985)" : "scale(1)",
                transition: "opacity 260ms ease, transform 260ms ease",
                willChange: "opacity, transform",
              }}
            />
          </div>
        </div>
      </div>

      {/* THUMBS */}
      <div className="w-full md:w-auto order-2 md:order-1">
        {/* MOBILE: горизонтально */}
        <div className="md:hidden">
          <div
            ref={thumbsRef}
            className="
              flex items-center gap-[10px]
              overflow-x-auto
              pb-[6px]
              [&::-webkit-scrollbar]:h-0
              [&::-webkit-scrollbar-thumb]:bg-transparent
            "
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {safe.map((src, idx) => {
              const isActive = idx === active;
              return (
                <button
                  key={src + idx}
                  data-idx={idx}
                  type="button"
                  onClick={() => {
                    setActive(idx);
                    scrollThumbIntoView(idx);
                  }}
                  className="h-[90px] w-[70px] shrink-0 flex items-center justify-center"
                  aria-label={`Фото ${idx + 1}`}
                >
                  <img
                    src={src}
                    alt={title}
                    className="h-full w-full object-contain"
                    draggable={false}
                    style={{
                      transform: isActive ? "scale(0.96)" : "scale(1)",
                      transition: "transform 180ms ease",
                      opacity: isActive ? 1 : 0.88,
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* DESKTOP: вертикально */}
        <div className="hidden md:block">
          <div
            ref={thumbsRef}
            className={[
              "mt-[40px]",
              "flex flex-col gap-[16px]",
              "h-[480px]",
              "overflow-y-auto pr-[10px]",
              "[&::-webkit-scrollbar]:w-0",
              "[&::-webkit-scrollbar-thumb]:bg-transparent",
            ].join(" ")}
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {safe.map((src, idx) => {
              const isActive = idx === active;
              return (
                <button
                  key={src + idx}
                  data-idx={idx}
                  type="button"
                  onClick={() => {
                    setActive(idx);
                    scrollThumbIntoView(idx);
                  }}
                  className="h-[200px] w-[140px] transition flex items-center justify-center"
                  aria-label={`Фото ${idx + 1}`}
                >
                  <img
                    src={src}
                    alt={title}
                    className="h-full w-full object-contain"
                    draggable={false}
                    style={{
                      transform: isActive ? "scale(0.985)" : "scale(1)",
                      transition: "transform 180ms ease",
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
