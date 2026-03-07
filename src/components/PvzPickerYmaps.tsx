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
    // API уже полностью загружен
    if (window.ymaps && window.ymaps.Map) {
      resolve();
      return;
    }

    // Скрипт уже добавлен на страницу
    const existingScript = document.querySelector(
      'script[src*="api-maps.yandex.ru"]'
    ) as HTMLScriptElement | null;

    if (existingScript) {
      const check = () => {
        if (window.ymaps && window.ymaps.ready) {
          window.ymaps.ready(() => resolve());
        } else {
          setTimeout(check, 50);
        }
      };

      check();
      return;
    }

    // Загружаем API только один раз
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(
      apiKey
    )}&lang=ru_RU`;
    s.async = true;

    s.onload = () => {
      if (window.ymaps && window.ymaps.ready) {
        window.ymaps.ready(() => resolve());
      } else {
        resolve();
      }
    };

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
  hideCityInput = false,
  autoLoad = true,
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_YMAPS_API_KEY || "";

  const [cityLocal, setCityLocal] = useState("");
  const [confirmedCity, setConfirmedCity] = useState(""); // ✅ выбранный из подсказки
  const effectiveCity = String((cityProp ?? confirmedCity) || "").trim();

  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<Pvz[]>([]);
  const [selected, setSelected] = useState<Pvz | null>(null);
  const [err, setErr] = useState<string>("");

  // ✅ подсказки городов
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggest, setSuggest] = useState<CitySuggest[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [suggestErr, setSuggestErr] = useState<string | null>(null);
  const suggestAbortRef = useRef<AbortController | null>(null);

  const cityInputRef = useRef<HTMLInputElement | null>(null);

  // ✅ режим: после выбора ПВЗ показываем адрес в этом же поле
  const [showAddressInCityInput, setShowAddressInCityInput] = useState(false);

  const cityInputValue = showAddressInCityInput
    ? String(selected?.address ?? "")
    : cityLocal;

  const cityInputReadOnly = showAddressInCityInput;

  // карта refs
  const mapRef = useRef<any>(null);
  const collectionRef = useRef<any>(null);
  const destroyRef = useRef(false);

  const center = useMemo(() => {
    if (selected) return [selected.lat, selected.lon];
    const p = points[0];
    return p ? [p.lat, p.lon] : [55.751244, 37.618423];
  }, [points, selected]);

  async function loadPoints(forCity: string) {
    setErr("");
    setSelected(null);
    setPoints([]);

    const c = String(forCity || "").trim();
    if (!c) {
      setErr("Введите город");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch(`/api/cdek/pvz?city=${encodeURIComponent(c)}`, {
        cache: "no-store",
      });
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

  // ✅ автозагрузка только если город пришёл извне
  useEffect(() => {
    if (!autoLoad) return;
    if (!apiKey) return;

    const c = String(cityProp ?? "").trim();
    if (!c) return;

    setShowAddressInCityInput(false);
    setConfirmedCity(c);
    setCityLocal(c);

    const t = setTimeout(() => {
      loadPoints(c).catch(() => {});
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityProp, autoLoad, apiKey]);

  // ✅ подсказки по мере ввода (ПВЗ НЕ грузим пока не выбрали подсказку)
  useEffect(() => {
    if (hideCityInput) return;
    if (showAddressInCityInput) return;

    const q = cityLocal.trim();
    setActiveIdx(-1);
    setSuggestErr(null);

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
        const r = await fetch(
          `/api/cdek/cities?q=${encodeURIComponent(q)}&limit=10`,
          {
            cache: "no-store",
            signal: ac.signal,
          }
        );
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "cities error");

        const items = Array.isArray(data?.items)
          ? (data.items as CitySuggest[])
          : [];
        setSuggest(items);
        setSuggestOpen(true);
      } catch (e: any) {
        if (String(e?.name) === "AbortError") return;
        setSuggest([]);
        setSuggestOpen(true);
        setSuggestErr(e?.message ? String(e.message) : "Не удалось загрузить города");
      } finally {
        setSuggestLoading(false);
      }
    }, 200);

    return () => clearTimeout(t);
  }, [cityLocal, hideCityInput, showAddressInCityInput]);

  function pickCityFromSuggest(value: string) {
    const v = String(value || "").trim();
    if (!v) return;

    setShowAddressInCityInput(false);

    setErr("");
    setSelected(null);
    setPoints([]);

    setConfirmedCity(v);
    setCityLocal(v);

    setSuggestOpen(false);
    setSuggest([]);
    setActiveIdx(-1);
    setSuggestErr(null);

    loadPoints(v).catch(() => {});
  }

  function resetAll() {
    setShowAddressInCityInput(false);

    setErr("");
    setSelected(null);
    setPoints([]);

    setCityLocal("");
    setConfirmedCity("");

    setSuggest([]);
    setSuggestErr(null);
    setSuggestOpen(false);
    setActiveIdx(-1);

    try {
      mapRef.current?.setCenter?.([55.751244, 37.618423], 10);
    } catch {}
  }

  // ✅ init map once — СРАЗУ (без ожидания points)
  useEffect(() => {
    destroyRef.current = false;

    async function initIfNeeded() {
      if (!apiKey) return;

      await loadYmaps(apiKey);
      await window.ymaps.ready();

      if (destroyRef.current) return;

      const el = document.getElementById("pvz-map");
      if (!el) return;

      if (mapRef.current && collectionRef.current) return;

      mapRef.current = new window.ymaps.Map("pvz-map", {
        center: [55.751244, 37.618423],
        zoom: 10,
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
  }, [apiKey]);

  // ✅ update marks (ждём, когда карта уже создана)
  useEffect(() => {
    async function updateMarks() {
      if (!apiKey) return;

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
          setShowAddressInCityInput(true);
          setSuggestOpen(false);
          onSelect({ code: p.code, address: p.address, city: effectiveCity });
        });

        collectionRef.current.add(placemark);
      }

      if (points.length) {
        mapRef.current.setCenter(center);
      }
    }

    updateMarks().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, points, center, effectiveCity, onSelect]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!points.length && !selected) return;
    mapRef.current.setCenter(center);
  }, [center, points.length, selected]);

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
        <div className="mt-2 text-[12px] text-red-600">
          NEXT_PUBLIC_YMAPS_API_KEY не задан
        </div>
      ) : null}

      {err ? <div className="mt-2 text-[12px] text-red-600">{err}</div> : null}

      {!hideCityInput ? (
        <div className="relative z-[9999]">
          <div className="flex gap-2">
            <input
              ref={cityInputRef}
              className="h-[46px] w-full border border-black/15 px-[14px] text-[14px] outline-none focus:border-black transition bg-white"
              placeholder={
                showAddressInCityInput
                  ? "Адрес пункта выдачи"
                  : "Начните вводить город…"
              }
              style={{ fontFamily: "Brygada" }}
              value={cityInputValue}
              readOnly={cityInputReadOnly}
              onChange={(e) => {
                if (showAddressInCityInput) return;

                setCityLocal(e.target.value);
                setConfirmedCity("");
                setPoints([]);
                setSelected(null);
                setErr("");
              }}
              onFocus={() => {
                if (showAddressInCityInput) return;
                if (suggest.length || suggestErr) setSuggestOpen(true);
              }}
              onBlur={() => {
                if (showAddressInCityInput) return;
                setTimeout(() => setSuggestOpen(false), 120);
              }}
              onKeyDown={(e) => {
                if (showAddressInCityInput) return;
                if (!suggestOpen || (suggest.length === 0 && !suggestErr)) return;

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIdx((x) => Math.min(x + 1, suggest.length - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIdx((x) => Math.max(x - 1, 0));
                }
                if (e.key === "Enter") {
                  if (suggest.length === 0) return;
                  e.preventDefault();
                  const picked = suggest[activeIdx] ?? suggest[0];
                  if (picked?.city) pickCityFromSuggest(picked.city);
                }
                if (e.key === "Escape") {
                  setSuggestOpen(false);
                }
              }}
            />

            {showAddressInCityInput ? (
              <button
                type="button"
                className="h-[46px] border border-black/15 px-[14px] text-[10px] font-bold uppercase tracking-[0.12em] hover:bg-black/5 transition"
                onClick={resetAll}
              >
                Изменить
              </button>
            ) : null}
          </div>

          {!showAddressInCityInput && suggestOpen ? (
            <div className="absolute z-[10000] mt-[6px] w-full border border-black/15 bg-white shadow-sm">
              {suggestLoading ? (
                <div className="px-[14px] py-[10px] text-[12px] text-black/50">
                  Ищем города…
                </div>
              ) : suggestErr ? (
                <div className="px-[14px] py-[10px] text-[12px] text-red-600">
                  {suggestErr}
                </div>
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
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickCityFromSuggest(s.city)}
                    >
                      <div className="text-black">{line}</div>
                    </button>
                  );
                })
              ) : (
                <div className="px-[14px] py-[10px] text-[12px] text-black/50">
                  Ничего не найдено
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-[12px] mb-[12px] grid gap-[12px] md:grid-cols-2">
        <div className="relative z-0 border border-black/15 overflow-hidden bg-white">
          <div id="pvz-map" className="h-[360px] w-full" />
        </div>

        <div className="border border-black/15 overflow-auto max-h-[360px] bg-white">
          {points.map((p) => (
            <button
              key={p.code}
              className={`block w-full border-b border-black/10 px-[14px] py-[12px] text-left text-[12px]
                          hover:bg-black/5 transition ${
                            selected?.code === p.code ? "bg-black/5" : ""
                          }`}
              onClick={() => {
                setSelected(p);
                setShowAddressInCityInput(true);
                setSuggestOpen(false);
                onSelect({ code: p.code, address: p.address, city: effectiveCity });
              }}
              type="button"
            >
              <div className="mt-[2px] text-[11px] uppercase tracking-[0.06em] text-black/80">
                {p.name}
              </div>
              <div className="mt-[6px] text-black/70">{p.address}</div>
              {p.workTime ? (
                <div className="mt-[6px] text-[11px] text-black/50">
                  {p.workTime}
                </div>
              ) : null}
            </button>
          ))}

          {!points.length ? (
            <div className="p-[14px] text-[12px] text-black/50">
              {effectiveCity
                ? loading
                  ? "Загружаем пункты…"
                  : "Пункты не найдены"
                : "Выберите город из подсказок — после этого появятся пункты выдачи"}
            </div>
          ) : null}
        </div>
      </div>
    </span>
  );
}