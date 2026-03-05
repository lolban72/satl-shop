"use client";

import { useEffect, useMemo, useState } from "react";

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
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Yandex Maps"));
    document.head.appendChild(s);
  });
}

export default function PvzPickerYmaps({
  onSelect,
}: {
  onSelect: (pvz: { code: string; address: string }) => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_YMAPS_API_KEY || "";

  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<Pvz[]>([]);
  const [selected, setSelected] = useState<Pvz | null>(null);
  const [err, setErr] = useState<string>("");

  // центр карты
  const center = useMemo(() => {
    if (selected) return [selected.lat, selected.lon];
    const p = points[0];
    return p ? [p.lat, p.lon] : [55.751244, 37.618423]; // дефолт: Москва
  }, [points, selected]);

  // init map whenever points change
  useEffect(() => {
    let map: any = null;
    let destroyed = false;

    async function init() {
      if (!apiKey) return;
      if (!points.length) return;

      await loadYmaps(apiKey);
      await window.ymaps.ready();

      if (destroyed) return;

      const el = document.getElementById("pvz-map");
      if (!el) return;

      // пересоздаём карту
      el.innerHTML = "";
      map = new window.ymaps.Map("pvz-map", {
        center,
        zoom: 12,
        controls: ["zoomControl"],
      });

      const collection = new window.ymaps.GeoObjectCollection();

      for (const p of points) {
        const placemark = new window.ymaps.Placemark(
          [p.lat, p.lon],
          {
            balloonContent:
              `<b>${p.name}</b><br/>${p.address}` +
              (p.workTime ? `<br/><small>${p.workTime}</small>` : ""),
          },
          { preset: "islands#darkBlueDotIcon" }
        );

        placemark.events.add("click", () => {
          setSelected(p);
          onSelect({ code: p.code, address: p.address });
        });

        collection.add(placemark);
      }

      map.geoObjects.add(collection);
      map.setCenter(center);
    }

    init().catch(() => {});

    return () => {
      destroyed = true;
      if (map) map.destroy?.();
    };
  }, [apiKey, points, center, onSelect]);

  async function loadPoints() {
    setErr("");
    setSelected(null);
    setPoints([]);

    const c = city.trim();
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

      const list = Array.isArray(data?.points) ? data.points : [];
      if (!list.length) setErr("ПВЗ не найдены");
      setPoints(list);
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border p-4">
      <div className="text-[14px] font-semibold">Доставка в ПВЗ СДЭК</div>

      <div className="mt-3 flex gap-2">
        <input
          className="h-10 w-full rounded-xl border px-3 text-[14px]"
          placeholder="Город (например: Краснодар)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <button
          className="h-10 rounded-xl border px-3 text-[14px] disabled:opacity-50"
          onClick={loadPoints}
          disabled={loading || !apiKey}
        >
          {loading ? "..." : "ПВЗ"}
        </button>
      </div>

      {!apiKey ? (
        <div className="mt-2 text-[12px] text-red-600">
          NEXT_PUBLIC_YMAPS_API_KEY не задан
        </div>
      ) : null}

      {err ? <div className="mt-2 text-[12px] text-red-600">{err}</div> : null}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div
          id="pvz-map"
          className="h-[360px] w-full rounded-2xl border"
        />

        <div className="max-h-[360px] overflow-auto rounded-2xl border">
          {points.map((p) => (
            <button
              key={p.code}
              className={`block w-full border-b px-3 py-2 text-left text-[13px] hover:bg-black/5 ${
                selected?.code === p.code ? "bg-black/5" : ""
              }`}
              onClick={() => {
                setSelected(p);
                onSelect({ code: p.code, address: p.address });
              }}
            >
              <div className="font-semibold">{p.name}</div>
              <div className="text-black/70">{p.address}</div>
              {p.workTime ? (
                <div className="text-[12px] text-black/50">{p.workTime}</div>
              ) : null}
            </button>
          ))}
          {!points.length ? (
            <div className="p-3 text-[12px] text-black/50">
              Введите город и нажмите «ПВЗ»
            </div>
          ) : null}
        </div>
      </div>

      {selected ? (
        <div className="mt-3 rounded-xl bg-black/5 p-3 text-[13px]">
          <div className="font-semibold">Выбран ПВЗ:</div>
          <div>{selected.address}</div>
          <div className="mt-1 text-[12px] text-black/60">
            Код: <span className="font-mono">{selected.code}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}