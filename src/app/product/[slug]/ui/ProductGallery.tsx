"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function ProductGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const safe = useMemo(
    () => (images?.length ? images.filter(Boolean) : []),
    [images]
  );

  const [active, setActive] = useState(0);
  const activeSrc = safe[active] ?? safe[0];

  const [displaySrc, setDisplaySrc] = useState(activeSrc);
  const [fade, setFade] = useState(false);

  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  const [originX, setOriginX] = useState(50);
  const [originY, setOriginY] = useState(50);

  const thumbsRef = useRef<HTMLDivElement | null>(null);
  const zoomImgRef = useRef<HTMLImageElement | null>(null);

  const pinchStateRef = useRef<{
    startDistance: number;
    startZoom: number;
    isPinching: boolean;
  } | null>(null);

  const panStateRef = useRef<{
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
    isPanning: boolean;
  } | null>(null);

  useEffect(() => {
    if (!safe.length) return;
    if (active > safe.length - 1) setActive(0);
  }, [safe, active]);

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
      if (window.innerWidth < 768) return;
      e.preventDefault();

      target += e.deltaY;

      const max = el.scrollHeight - el.clientHeight;
      if (target < 0) target = 0;
      if (target > max) target = max;

      if (!raf) raf = requestAnimationFrame(animate);
    };

    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel as EventListener);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!zoomOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeZoom();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [zoomOpen]);

  function scrollThumbIntoView(idx: number) {
    const root = thumbsRef.current;
    if (!root) return;
    const btn = root.querySelector<HTMLButtonElement>(`button[data-idx="${idx}"]`);
    if (!btn) return;

    btn.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }

  function goPrev(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (safe.length <= 1) return;
    setActive((prev) => (prev === 0 ? safe.length - 1 : prev - 1));
    resetZoomState();
  }

  function goNext(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (safe.length <= 1) return;
    setActive((prev) => (prev === safe.length - 1 ? 0 : prev + 1));
    resetZoomState();
  }

  function resetZoomState() {
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setOriginX(50);
    setOriginY(50);
    pinchStateRef.current = null;
    panStateRef.current = null;
  }

  function openZoom() {
    setZoomOpen(true);
    resetZoomState();
  }

  function closeZoom() {
    setZoomOpen(false);
    resetZoomState();
  }

  function distance(
    t1: { clientX: number; clientY: number },
    t2: { clientX: number; clientY: number }
  ) {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function clampZoom(value: number) {
    return Math.max(1, Math.min(4, value));
  }

  function setOriginFromClientPoint(clientX: number, clientY: number) {
    const el = zoomImgRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    setOriginX(Math.max(0, Math.min(100, x)));
    setOriginY(Math.max(0, Math.min(100, y)));
  }

  function handleTouchStart(e: React.TouchEvent<HTMLImageElement>) {
    e.stopPropagation();

    if (e.touches.length === 2) {
      const d = distance(e.touches[0], e.touches[1]);
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      setOriginFromClientPoint(centerX, centerY);

      pinchStateRef.current = {
        startDistance: d,
        startZoom: zoom,
        isPinching: true,
      };
      panStateRef.current = null;
      return;
    }

    if (e.touches.length === 1 && zoom > 1) {
      panStateRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        originPanX: panX,
        originPanY: panY,
        isPanning: true,
      };
    }
  }

  function handleTouchMove(e: React.TouchEvent<HTMLImageElement>) {
    e.stopPropagation();

    if (e.touches.length === 2) {
      e.preventDefault();

      const pinch = pinchStateRef.current;
      if (!pinch) return;

      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setOriginFromClientPoint(centerX, centerY);

      const d = distance(e.touches[0], e.touches[1]);
      const scale = d / pinch.startDistance;
      const nextZoom = clampZoom(pinch.startZoom * scale);
      setZoom(nextZoom);

      if (nextZoom <= 1) {
        setPanX(0);
        setPanY(0);
      }

      return;
    }

    if (e.touches.length === 1 && zoom > 1) {
      const pan = panStateRef.current;
      if (!pan?.isPanning) return;

      e.preventDefault();

      const dx = e.touches[0].clientX - pan.startX;
      const dy = e.touches[0].clientY - pan.startY;

      setPanX(pan.originPanX + dx);
      setPanY(pan.originPanY + dy);
    }
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLImageElement>) {
    e.stopPropagation();

    if (e.touches.length < 2) {
      pinchStateRef.current = null;
    }

    if (e.touches.length === 0) {
      panStateRef.current = null;
      if (zoom <= 1) {
        setPanX(0);
        setPanY(0);
      }
    }
  }

  if (!safe.length) return null;

  return (
    <>
      <div className="flex flex-col md:flex-row items-start gap-[14px] sm:gap-[18px] md:gap-[24px]">
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

            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <img
                src={displaySrc}
                alt={title}
                className="h-full w-full object-contain cursor-zoom-in select-none"
                draggable={false}
                onClick={openZoom}
                style={{
                  opacity: fade ? 0 : 1,
                  transform: fade ? "scale(0.985)" : "scale(1)",
                  transition: "opacity 260ms ease, transform 260ms ease",
                  willChange: "opacity, transform",
                }}
              />
            </div>

            {safe.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="
                    absolute left-[8px] md:left-[12px] top-1/2 z-20 -translate-y-1/2
                    h-8 w-8 md:h-9 md:w-9
                    rounded-full border border-white/50 bg-black/20
                    text-white backdrop-blur-sm
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
                    absolute right-[8px] md:right-[12px] top-1/2 z-20 -translate-y-1/2
                    h-8 w-8 md:h-9 md:w-9
                    rounded-full border border-white/50 bg-black/20
                    text-white backdrop-blur-sm
                    flex items-center justify-center
                  "
                  aria-label="Следующее фото"
                >
                  ›
                </button>

                <div className="absolute bottom-[10px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5">
                  {safe.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActive(idx);
                        resetZoomState();
                      }}
                      className={`rounded-full transition-all ${
                        idx === active
                          ? "w-5 h-1.5 bg-white"
                          : "w-1.5 h-1.5 bg-white/50"
                      }`}
                      aria-label={`Перейти к фото ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="w-full md:w-auto order-2 md:order-1">
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
                      resetZoomState();
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
                      resetZoomState();
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
                        opacity: isActive ? 1 : 0.9,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {zoomOpen && (
        <div
          className="fixed inset-0 z-[999] bg-white/92 backdrop-blur-[2px]"
          onClick={closeZoom}
        >
          <div className="flex min-h-screen items-center justify-center p-6 md:p-12">
            <img
              ref={zoomImgRef}
              src={safe[active]}
              alt={title}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setOriginFromClientPoint(e.clientX, e.clientY);

                if (zoom > 1) {
                  setZoom(1);
                  setPanX(0);
                  setPanY(0);
                } else {
                  setZoom(2);
                }
              }}
              onWheel={(e) => {
                e.preventDefault();
                e.stopPropagation();

                setOriginFromClientPoint(e.clientX, e.clientY);

                setZoom((z) => {
                  const next =
                    e.deltaY < 0
                      ? Math.min(4, +(z + 0.15).toFixed(2))
                      : Math.max(1, +(z - 0.15).toFixed(2));

                  if (next <= 1) {
                    setPanX(0);
                    setPanY(0);
                  }

                  return next;
                });
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              className="select-none object-contain"
              style={{
                transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                maxWidth: "88vw",
                maxHeight: "88vh",
                cursor: zoom > 1 ? "grab" : "zoom-in",
                transition:
                  pinchStateRef.current?.isPinching ||
                  panStateRef.current?.isPanning
                    ? "none"
                    : "transform 180ms ease",
                touchAction: "none",
                WebkitUserSelect: "none",
                transformOrigin: `${originX}% ${originY}%`,
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}