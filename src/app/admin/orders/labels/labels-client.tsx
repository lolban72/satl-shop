"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { toPng } from "html-to-image";

function val(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

function OneLabelHTML({ order, htmlRef }: any) {
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  const firstItem = useMemo(() => {
    const items = Array.isArray(order?.items) ? order.items : [];
    return items[0] ?? null;
  }, [order?.items]);

  const productTitle = val(firstItem?.title);
  const size = val(firstItem?.variant?.size);
  const pvz = val(order?.address);
  const track = val(
    order?.track ??
      order?.trackingNumber ??
      order?.trackNumber ??
      order?.tracking ??
      order?.trackId
  );

  useEffect(() => {
    if (!barcodeRef.current) return;
    JsBarcode(barcodeRef.current, String(order?.id ?? ""), {
      format: "CODE128",
      width: 2,
      height: 70,
      displayValue: false,
      margin: 0,
    });
  }, [order?.id]);

  return (
    <div
      ref={htmlRef}
      className="print-area w-[180mm] p-4 text-black bg-white"
      style={{ fontFamily: "Brygada" }}
    >
      <div className="w-full flex justify-center">
        <svg ref={barcodeRef} className="w-full" />
      </div>

      <div className="mt-6 space-y-3 text-[18px] leading-[1.2]">
        <div>
          <span className="font-bold">Товар:</span> <span>{productTitle}</span>
        </div>
        <div>
          <span className="font-bold">Размер:</span> <span>{size}</span>
        </div>
        <div>
          <span className="font-bold">ПВЗ:</span> <span>{pvz}</span>
        </div>
        <div>
          <span className="font-bold">Трек номер:</span> <span>{track}</span>
        </div>
        <div>
          <span className="font-bold">Номер заказа:</span>{" "}
          <span className="font-mono">{val(order?.id)}</span>
        </div>
      </div>
    </div>
  );
}

export default function LabelsClient({ orders }: { orders: any[] }) {
  const [images, setImages] = useState<string[]>([]);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // даём DOM отрисоваться + штрих-коду проставиться
      await new Promise((r) => setTimeout(r, 300));

      const urls: string[] = [];
      for (let i = 0; i < orders.length; i++) {
        const node = refs.current[i];
        if (!node) continue;

        // scale ↑ = качество ↑
        const url = await toPng(node, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
        });

        urls.push(url);
      }

      if (!cancelled) {
        setImages(urls);

        // печать один раз, когда картинки готовы
        setTimeout(() => window.print(), 300);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [orders]);

  return (
    <div className="label-root">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .label-root, .label-root * { visibility: visible !important; }
          body { margin: 0 !important; padding: 0 !important; }
          .label-root { position: absolute; left: 0; top: 0; width: 100%; }

          /* печатаем картинки постранично */
          .img-page { page-break-after: always; }
          .img-page:last-child { page-break-after: auto; }
        }
      `}</style>

      {/* Скрытый рендер HTML (источник для PNG) */}
      <div style={{ position: "absolute", left: "-99999px", top: 0 }}>
        {orders.map((o, i) => (
          <OneLabelHTML
            key={o.id}
            order={o}
            htmlRef={(el: HTMLDivElement | null) => (refs.current[i] = el)}
          />
        ))}
      </div>

      {/* Печатаем уже PNG */}
      {images.map((src, i) => (
        <div key={i} className="img-page">
          <img src={src} alt="" style={{ width: "180mm" }} />
        </div>
      ))}
    </div>
  );
}