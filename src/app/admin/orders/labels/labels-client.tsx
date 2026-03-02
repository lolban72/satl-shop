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

/**
 * ✅ Короткое значение для штрих-кода (для тестов печати)
 * ВАЖНО: это не меняет реальный order.id, только то, что кодируется в barcode.
 */
function barcodeValueFromOrderId(id: any) {
  const s = String(id ?? "");
  return s.length > 10 ? s.slice(0, 10) : s;
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

  const size = val(firstItem?.variant?.size);

  const barcodeValue = useMemo(() => {
    return barcodeValueFromOrderId(order?.id);
  }, [order?.id]);

  useEffect(() => {
    if (!barcodeRef.current) return;

    JsBarcode(barcodeRef.current, barcodeValue, {
      format: "CODE128",
      width: 0.9,
      height: 18,
      displayValue: false,
      margin: 0,
    });
  }, [barcodeValue]);

  return (
    <div ref={htmlRef} className="label-58x40">
      <svg ref={barcodeRef} className="barcode" />

      <div className="meta">
        <div className="row">
          <span className="k">ID:</span>
          <span className="v mono">{barcodeValue || shortId(order?.id)}</span>
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
      // ждём отрисовки DOM и штрих-кода
      await new Promise((r) => setTimeout(r, 400));

      const urls: string[] = [];

      for (let i = 0; i < orders.length; i++) {
        const node = refs.current[i];
        if (!node) continue;

        const url = await toPng(node, {
          cacheBust: true,
          pixelRatio: 3,
          backgroundColor: "#ffffff",
        });

        urls.push(url);
      }

      if (cancelled) return;

      // ✅ на всякий: убираем пустые
      const clean = urls.filter(Boolean);

      setImages(clean);

      // ✅ печатаем строго после того, как React отрендерил картинки
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
        });
      });
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

        /* Скрытый HTML для генерации PNG */
        .hidden-render {
          position: absolute;
          left: -99999px;
          top: 0;
        }

        /* Точная геометрия 58×40 */
        .label-58x40 {
          width: 58mm;
          height: 40mm;
          box-sizing: border-box;
          padding: 1.5mm;
          display: flex;
          flex-direction: column;
          gap: 1mm;
          background: #fff;
          color: #000;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        }

        .barcode {
          width: 100%;
          height: auto;
        }

        .meta {
          font-size: 7px;
          line-height: 1.05;
        }

        .row {
          display: flex;
          gap: 2mm;
          align-items: baseline;
        }

        .k { font-weight: 800; }

        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
        }

        @media print {
          /* ✅ Скрываем всё, кроме картинок-страниц */
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

          /* ✅ КРИТИЧНО: НЕ печатать hidden-render (он и давал пустые листы) */
          .hidden-render {
            display: none !important;
            visibility: hidden !important;
          }

          /* каждая картинка = отдельная наклейка */
          .img-page {
            width: 58mm;
            height: 40mm;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          /* ✅ разрыв страницы ТОЛЬКО между реальными страницами */
          .img-page:not(:last-child) {
            page-break-after: always;
            break-after: page;
          }

          img {
            display: block;
            width: 58mm;
            height: 40mm;
            object-fit: contain;
          }
        }
      `}</style>

      {/* HTML-источник (нужен только чтобы собрать PNG) */}
      <div className="hidden-render">
        {orders.map((o, i) => (
          <OneLabelHTML
            key={o.id}
            order={o}
            htmlRef={(el) => (refs.current[i] = el)}
          />
        ))}
      </div>

      {/* Печатаем PNG (строго столько, сколько images) */}
      {images.map((src, i) => (
        <div key={i} className="img-page">
          <img src={src} alt="" />
        </div>
      ))}
    </div>
  );
}