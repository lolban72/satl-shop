"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { toPng } from "html-to-image";

function val(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

function shortId(id: any) {
  const s = String(id ?? "");
  return s.length > 10 ? s.slice(0, 10) + "…" : s;
}

function OneLabelHTML({
  order,
  htmlRef,
}: {
  order: any;
  htmlRef: (el: HTMLDivElement | null) => void;
}) {
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  const firstItem = useMemo(() => {
    const items = Array.isArray(order?.items) ? order.items : [];
    return items[0] ?? null;
  }, [order?.items]);

  // На 58×40 не влезает много текста — оставим самое полезное
  const size = val(firstItem?.variant?.size);

  useEffect(() => {
    if (!barcodeRef.current) return;

    // ✅ Под 58mm: компактный штрих-код
    JsBarcode(barcodeRef.current, String(order?.id ?? ""), {
      format: "CODE128",
      width: 1.2,     // толщина линий
      height: 22,     // высота штрихкода (в px, но под нашу область ок)
      displayValue: false,
      margin: 0,
    });
  }, [order?.id]);

  return (
    <div ref={htmlRef} className="label-58x40">
      <svg ref={barcodeRef} className="barcode" />
      <div className="meta">
        <div className="row">
          <span className="k">ID:</span>
          <span className="v mono">{shortId(order?.id)}</span>
        </div>
        <div className="row">
          <span className="k">SIZE:</span>
          <span className="v">{size}</span>
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
      // ждём, пока DOM и баркоды отрисуются
      await new Promise((r) => setTimeout(r, 450));

      const urls: string[] = [];

      for (let i = 0; i < orders.length; i++) {
        const node = refs.current[i];
        if (!node) continue;

        const url = await toPng(node, {
          cacheBust: true,
          pixelRatio: 3, // ✅ качество выше
          backgroundColor: "#ffffff",
        });

        urls.push(url);
      }

      if (cancelled) return;

      setImages(urls);

      // печать один раз, когда PNG готовы
      setTimeout(() => window.print(), 250);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [orders]);

  return (
    <div className="label-root">
      <style>{`
        /* ✅ Размер страницы = размер наклейки */
        @page {
          size: 58mm 40mm;
          margin: 0;
        }

        /* Скрытый HTML-рендер для генерации PNG */
        .hidden-render {
          position: absolute;
          left: -99999px;
          top: 0;
        }

        /* Точная геометрия этикетки 58×40 */
        .label-58x40 {
          width: 58mm;
          height: 40mm;
          box-sizing: border-box;
          padding: 2mm 2mm 1.5mm 2mm;
          display: flex;
          flex-direction: column;
          gap: 1.5mm;
          color: #000;
          background: #fff;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        }

        .barcode {
          width: 100%;
          height: auto;
        }

        .meta {
          font-size: 9px;
          line-height: 1.15;
        }

        .row {
          display: flex;
          gap: 2mm;
          align-items: baseline;
        }

        .k { font-weight: 800; }
        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }

        @media print {
          /* ✅ печатаем ТОЛЬКО область label-root */
          body * { visibility: hidden !important; }
          .label-root, .label-root * { visibility: visible !important; }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
          }

          .label-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
          }

          /* ✅ каждая картинка = отдельная наклейка */
          .img-page { width: 58mm; height: 40mm; }
          .img-page { break-after: page; page-break-after: always; }
          .img-page:last-child { break-after: auto; page-break-after: auto; }

          /* убираем любые авто-поля */
          img { display: block; width: 58mm; height: 40mm; object-fit: contain; }
        }
      `}</style>

      {/* 1) Скрытый источник (HTML) */}
      <div className="hidden-render">
        {orders.map((o, i) => (
          <OneLabelHTML
            key={o.id}
            order={o}
            htmlRef={(el) => (refs.current[i] = el)}
          />
        ))}
      </div>

      {/* 2) Печать PNG */}
      {images.map((src, i) => (
        <div key={i} className="img-page">
          <img src={src} alt="" />
        </div>
      ))}
    </div>
  );
}