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

declare global {
  interface Window {
    ymaps?: any;
  }
}

function loadYmaps(apiKey: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.ymaps) return resolve();

    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(
      apiKey
    )}&lang=ru_RU`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Yandex Maps"));
    document.head.appendChild(s);
  });
}

type Props = {
  // ✅ теперь отдаём ещё и city (чтобы родитель не гадал)
  onSelect: (pvz: { code: string; address: string; city: string }) => void;

  // ✅ единственный источник города (из CheckoutForm)
  city?: string;

  // ✅ скрыть внутренний инпут города (по умолчанию скрыт)
  hideCityInput?: boolean;

  // ✅ автозагрузка ПВЗ при наличии city
  autoLoad?: boolean;
};

export default function PvzPickerYmaps({
  onSelect,
  city: cityProp,
  hideCityInput = true,
  autoLoad = true,
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_YMAPS_API_KEY || "";

  // если вдруг используешь без cityProp — можно включить инпут
  const [cityLocal, setCityLocal] = useState("");
  const effectiveCity = String((cityProp ?? cityLocal) || "").trim();

  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<Pvz[]>([]);
  const [selected, setSelected] = useState<Pvz | null>(null);
  const [err, setErr] = useState<string>("");

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

  // ✅ init map once (когда появились точки)
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

      // если карта уже создана — только обновим
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
      // не уничтожаем карту на каждый ререндер —
      // уничтожим только при размонтировании компонента:
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, points.length]);

  // ✅ обновляем метки при изменении points
  useEffect(() => {
    async function updateMarks() {
      if (!apiKey) return;
      if (!points.length) return;

      await loadYmaps(apiKey);
      await window.ymaps.ready();
      if (!mapRef.current || !collectionRef.current) return;

      // очищаем старые метки
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

  // ✅ центрируем карту при выборе
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setCenter(center);
  }, [center]);

  // ✅ уничтожаем карту только при размонтировании
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
    <div className="p-[14px]">

      {!apiKey ? (
        <div className="mt-2 text-[12px] text-red-600">
          NEXT_PUBLIC_YMAPS_API_KEY не задан
        </div>
      ) : null}

      {err ? <div className="mt-2 text-[12px] text-red-600">{err}</div> : null}

      {/* ✅ второй ввод города выключен по умолчанию */}
      {!hideCityInput ? (
        <div className="mt-3 flex gap-2">
          <input
            className="h-[46px] w-full px-[14px] text-[14px] outline-none focus:border-black transition bg-white"
            placeholder="Город"
            value={cityLocal}
            onChange={(e) => setCityLocal(e.target.value)}
          />
          <button
            className="h-[46px] border border-black/15 px-[14px] text-[10px] font-bold uppercase tracking-[0.12em]
                       hover:bg-black/5 transition disabled:opacity-50"
            onClick={() => loadPoints(cityLocal)}
            disabled={loading || !apiKey}
            type="button"
          >
            {loading ? "..." : "Показать"}
          </button>
        </div>
      ) : null}

      <div className="mt-[12px] grid gap-[12px] md:grid-cols-2">
        <div className="border border-black/15 rounded-[14px] overflow-hidden bg-white">
          <div id="pvz-map" className="h-[360px] w-full" />
        </div>

        <div className="border border-black/15 rounded-[14px] overflow-auto max-h-[360px] bg-white">
          {points.map((p) => (
            <button
              key={p.code}
              className={`block w-full border-b border-black/10 px-[14px] py-[12px] text-left text-[12px]
                          hover:bg-black/5 transition ${
                            selected?.code === p.code ? "bg-black/5" : ""
                          }`}
              onClick={() => {
                setSelected(p);
                onSelect({ code: p.code, address: p.address, city: effectiveCity });
              }}
              type="button"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em]">
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
                ? "Пункты выдачи загружаются или не найдены"
                : "Укажите город сверху"}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}