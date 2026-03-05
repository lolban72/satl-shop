"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Pvz = {
  code: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  workTime?: string;
};

type CitySuggest = {
  city: string;
  region?: string;
  country?: string;
};

declare global {
  interface Window {
    ymaps?: any;
  }
}

function loadYmaps(apiKey: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.ymaps) return resolve();

    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Yandex Maps"));
    document.head.appendChild(s);
  });
}

type Props = {
  onSelect: (pvz: { code: string; address: string; city: string }) => void;
  city?: string;
  hideCityInput?: boolean;
  autoLoad?: boolean;
};

export default function PvzPickerYmaps({
  onSelect,
  city: cityProp,
  hideCityInput = true,
  autoLoad = true,
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_YMAPS_API_KEY || "";

  const [cityLocal, setCityLocal] = useState("");
  const effectiveCity = String((cityProp ?? cityLocal) || "").trim();

  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<Pvz[]>([]);
  const [selected, setSelected] = useState<Pvz | null>(null);
  const [err, setErr] = useState<string>("");

  // ✅ подсказки городов
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggest, setSuggest] = useState<CitySuggest[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const suggestAbortRef = useRef<AbortController | null>(null);

  const cityInputRef = useRef<HTMLInputElement | null>(null);

  // refs для карты, чтобы не пересоздавать постоянно
  const mapRef = useRef<any>(null);
  const collectionRef = useRef<any>(null);
  const destroyRef = useRef(false);

  const center = useMemo(() => {
    if (selected) return [selected.lat, selected.lon];
    const p = points[0];
    return p ? [p.lat, p.lon] : [55.751244, 37.618423];
  }, [points, selected]);

  async function loadPoints(forCity?: string) {
    setErr("");
    setSelected(null);
    setPoints([]);

    const c = String(forCity ?? effectiveCity).trim();
    if (!c) {
      setErr("Введите город");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch(`/api/cdek/pvz?city=${encodeURIComponent(c)}`, { cache: "no-store" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Не удалось получить ПВЗ");

      const list = Array.isArray(data?.points) ? (data.points as Pvz[]) : [];
      if (!list.length) setErr("ПВЗ не найдены");
      setPoints(list);
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  // ✅ подсказки городов (только когда есть внутренний инпут)
  useEffect(() => {
    if (hideCityInput) return;

    const q = cityLocal.trim();
    setActiveIdx(-1);

    // закрываем, если мало символов
    if (q.length < 2) {
      setSuggest([]);
      setSuggestOpen(false);
      suggestAbortRef.current?.abort();
      return;
    }

    const t = setTimeout(async () => {
      suggestAbortRef.current?.abort();
      const ac = new AbortController();
      suggestAbortRef.current = ac;

      setSuggestLoading(true);
      try {
        const r = await fetch(`/api/cdek/cities?q=${encodeURIComponent(q)}&limit=10`, {
          cache: "no-store",
          signal: ac.signal,
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "cities error");

        const items = Array.isArray(data?.items) ? (data.items as CitySuggest[]) : [];
        setSuggest(items);
        setSuggestOpen(true);
      } catch (e: any) {
        if (String(e?.name) === "AbortError") return;
        setSuggest([]);
        setSuggestOpen(false);
      } finally {
        setSuggestLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [cityLocal, hideCityInput]);

  function pickCity(value: string) {
    const v = String(value || "").trim();
    if (!v) return;

    setCityLocal(v);
    setSuggestOpen(false);
    setSuggest([]);
    setActiveIdx(-1);

    loadPoints(v).catch(() => {});
  }

  // ✅ автозагрузка при смене города сверху
  useEffect(() => {
    if (!autoLoad) return;
    if (!apiKey) return;

    if (!effectiveCity) {
      setPoints([]);
      setSelected(null);
      setErr("");
      return;
    }

    const t = setTimeout(() => {
      loadPoints(effectiveCity).catch(() => {});
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCity, autoLoad, apiKey]);

  // ✅ init map once
  useEffect(() => {
    destroyRef.current = false;

    async function initIfNeeded() {
      if (!apiKey) return;
      if (!points.length) return;

      await loadYmaps(apiKey);
      await window.ymaps.ready();

      if (destroyRef.current) return;

      const el = document.getElementById("pvz-map");
      if (!el) return;

      if (mapRef.current && collectionRef.current) return;

      mapRef.current = new window.ymaps.Map("pvz-map", {
        center,
        zoom: 12,
        controls: ["zoomControl"],
      });

      collectionRef.current = new window.ymaps.GeoObjectCollection();
      mapRef.current.geoObjects.add(collectionRef.current);
    }

    initIfNeeded().catch(() => {});

    return () => {
      destroyRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, points.length]);

  // ✅ update marks
  useEffect(() => {
    async function updateMarks() {
      if (!apiKey) return;
      if (!points.length) return;

      await loadYmaps(apiKey);
      await window.ymaps.ready();
      if (!mapRef.current || !collectionRef.current) return;

      collectionRef.current.removeAll();

      for (const p of points) {
        const placemark = new window.ymaps.Placemark(
          [p.lat, p.lon],
          {
            balloonContent:
              `<b>${p.name}</b><br/>${p.address}` +
              (p.workTime ? `<br/><small>${p.workTime}</small>` : ""),
          },
          { preset: "islands#blackDotIcon" }
        );

        placemark.events.add("click", () => {
          setSelected(p);
          onSelect({ code: p.code, address: p.address, city: effectiveCity });
        });

        collectionRef.current.add(placemark);
      }

      mapRef.current.setCenter(center);
    }

    updateMarks().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, points, center, effectiveCity, onSelect]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setCenter(center);
  }, [center]);

  useEffect(() => {
    return () => {
      try {
        mapRef.current?.destroy?.();
      } catch {}
      mapRef.current = null;
      collectionRef.current = null;
    };
  }, []);

  return (
    <span>
      {!apiKey ? (
        <div className="mt-2 text-[12px] text-red-600">NEXT_PUBLIC_YMAPS_API_KEY не задан</div>
      ) : null}

      {err ? <div className="mt-2 text-[12px] text-red-600">{err}</div> : null}

      {/* ✅ город: с автоподсказками */}
      {!hideCityInput ? (
        <div className="relative">
          <div className="flex gap-2">
            <input
              ref={cityInputRef}
              className="h-[46px] w-full border border-black/15 px-[14px] text-[14px] outline-none focus:border-black transition bg-white"
              placeholder="Город"
              value={cityLocal}
              onChange={(e) => setCityLocal(e.target.value)}
              onFocus={() => {
                if (suggest.length) setSuggestOpen(true);
              }}
              onBlur={() => {
                // даём кликнуть по пункту
                setTimeout(() => setSuggestOpen(false), 120);
              }}
              onKeyDown={(e) => {
                if (!suggestOpen || suggest.length === 0) return;

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIdx((x) => Math.min(x + 1, suggest.length - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIdx((x) => Math.max(x - 1, 0));
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  const picked = suggest[activeIdx] ?? suggest[0];
                  if (picked?.city) pickCity(picked.city);
                }
                if (e.key === "Escape") {
                  setSuggestOpen(false);
                }
              }}
            />

            <button
              className="h-[46px] border border-black/15 px-[14px] text-[10px] font-bold uppercase tracking-[0.12em]
                         hover:bg-black/5 transition disabled:opacity-50"
              onClick={() => pickCity(cityLocal)}
              disabled={loading || !apiKey || cityLocal.trim().length < 2}
              type="button"
            >
              {loading ? "..." : "Показать"}
            </button>
          </div>

          {/* dropdown */}
          {suggestOpen ? (
            <div className="absolute z-[50] mt-[6px] w-full border border-black/15 bg-white shadow-sm">
              {suggestLoading ? (
                <div className="px-[14px] py-[10px] text-[12px] text-black/50">Ищем города…</div>
              ) : suggest.length ? (
                suggest.map((s, idx) => {
                  const line = [s.city, s.region].filter(Boolean).join(", ");
                  const active = idx === activeIdx;
                  return (
                    <button
                      key={`${s.city}-${s.region ?? ""}-${idx}`}
                      type="button"
                      className={`block w-full text-left px-[14px] py-[10px] text-[12px] border-b border-black/10 hover:bg-black/5 ${
                        active ? "bg-black/5" : ""
                      }`}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => pickCity(s.city)}
                    >
                      <div className="text-black">{line}</div>
                    </button>
                  );
                })
              ) : (
                <div className="px-[14px] py-[10px] text-[12px] text-black/50">Ничего не найдено</div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-[12px] mb-[12px] grid gap-[12px] md:grid-cols-2">
        <div className="border border-black/15 overflow-hidden bg-white">
          <div id="pvz-map" className="h-[360px] w-full" />
        </div>

        <div className="border border-black/15 overflow-auto max-h-[360px] bg-white">
          {points.map((p) => (
            <button
              key={p.code}
              className={`block w-full border-b border-black/10 px-[14px] py-[12px] text-left text-[12px]
                          hover:bg-black/5 transition ${selected?.code === p.code ? "bg-black/5" : ""}`}
              onClick={() => {
                setSelected(p);
                onSelect({ code: p.code, address: p.address, city: effectiveCity });
              }}
              type="button"
            >
              <div className="mt-[6px] text-black/70">{p.address}</div>
              {p.workTime ? <div className="mt-[6px] text-[11px] text-black/50">{p.workTime}</div> : null}
            </button>
          ))}

          {!points.length ? (
            <div className="p-[14px] text-[12px] text-black/50">
              {effectiveCity ? "Пункты выдачи загружаются или не найдены" : "Укажите город сверху"}
            </div>
          ) : null}
        </div>
      </div>
    </span>
  );
}