"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { toPng } from "html-to-image";

function val(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

// короткое значение для штрих-кода
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

  const barcodeValue = useMemo(() => {
    return barcodeValueFromOrderId(order?.id);
  }, [order?.id]);

  const productTitle = val(firstItem?.title);
  const size = val(firstItem?.variant?.size);
  const pvz = val(order?.pvz || order?.pickupPoint || "СДЭК");
  const trackNumber = val(order?.trackNumber || "-");

  useEffect(() => {
    if (!barcodeRef.current) return;

    // ✅ штрих-код больше + выше
    JsBarcode(barcodeRef.current, barcodeValue, {
      format: "CODE128",
      width: 1.25,   // толще линии (больше сам barcode)
      height: 26,    // выше
      displayValue: false,
      margin: 0,
    });
  }, [barcodeValue]);

  return (
    <div ref={htmlRef} className="label-58x40">
      {/* ✅ по центру сверху */}
      <div className="barcode-wrap">
        <svg ref={barcodeRef} className="barcode" />
      </div>

      {/* ✅ весь текст слева */}
      <div className="meta">
        <div className="row">
          <span className="k">Товар:</span>
          <span className="v">{productTitle}</span>
        </div>

        <div className="row">
          <span className="k">Размер:</span>
          <span className="v">{size}</span>
        </div>

        <div className="row">
          <span className="k">ПВЗ:</span>
          <span className="v">{pvz}</span>
        </div>

        <div className="row">
          <span className="k">№ заказа:</span>
          <span className="v mono">{barcodeValue}</span>
        </div>

        <div className="row">
          <span className="k">Трек:</span>
          <span className="v mono">{trackNumber}</span>
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
      await new Promise((r) => setTimeout(r, 450));

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

      setImages(urls.filter(Boolean));

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
        @page {
          size: 58mm 40mm;
          margin: 0;
        }

        .hidden-render {
          position: absolute;
          left: -99999px;
          top: 0;
        }

        .label-58x40 {
          width: 58mm;
          height: 40mm;
          box-sizing: border-box;
          padding: 1.5mm;
          display: flex;
          flex-direction: column;
          gap: 1.2mm;
          background: #fff;
          color: #000;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        }

        /* ✅ штрих-код по центру сверху */
        .barcode-wrap {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding-top: 0.2mm;
        }

        .barcode {
          width: 54mm; /* ✅ делаем шире, но с отступами */
          height: auto;
        }

        /* ✅ весь текст слева */
        .meta {
          font-size: 7px;
          line-height: 1.1;
          display: flex;
          flex-direction: column;
          gap: 0.7mm;
          text-align: left;
        }

        .row {
          display: flex;
          gap: 2mm;
          align-items: baseline;
          justify-content: flex-start; /* ✅ не раздвигаем */
        }

        .k {
          font-weight: 800;
          white-space: nowrap;
          flex: 0 0 auto;
        }

        .v {
          flex: 1 1 auto;
          min-width: 0;
          text-align: left; /* ✅ значения тоже слева */
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
          letter-spacing: 0.02em;
        }

        @media print {
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

          .hidden-render {
            display: none !important;
          }

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

      <div className="hidden-render">
        {orders.map((o, i) => (
          <OneLabelHTML
            key={o.id}
            order={o}
            htmlRef={(el) => (refs.current[i] = el)}
          />
        ))}
      </div>

      {images.map((src, i) => (
        <div key={i} className="img-page">
          <img src={src} alt="" />
        </div>
      ))}
    </div>
  );
}