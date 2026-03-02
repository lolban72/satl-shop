"use client";

import { useEffect, useMemo, useRef } from "react";
import JsBarcode from "jsbarcode";

function val(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

// короткое значение для штрих-кода
function barcodeValueFromOrderId(id: any) {
  const s = String(id ?? "");
  return s.length > 10 ? s.slice(0, 10) : s;
}

function OneLabelHTML({ order }: { order: any }) {
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

    JsBarcode(barcodeRef.current, barcodeValue, {
      format: "CODE128",
      width: 1.25,
      height: 26,
      displayValue: false,
      margin: 0,
    });
  }, [barcodeValue]);

  return (
    <div className="label-58x40">
      <div className="barcode-wrap">
        <svg ref={barcodeRef} className="barcode" />
      </div>

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
  useEffect(() => {
    // даём время браузеру отрисовать и JsBarcode вставить штрихкоды
    const t = setTimeout(() => {
      window.print();
    }, 600);

    return () => clearTimeout(t);
  }, [orders?.length]);

  return (
    <div className="label-root">
      <style>{`
        @page {
          size: 58mm 40mm;
          margin: 0;
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

        .barcode-wrap {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding-top: 0.2mm;
        }

        .barcode {
          width: 54mm;
          height: auto;
        }

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
          justify-content: flex-start;
        }

        .k {
          font-weight: 800;
          white-space: nowrap;
          flex: 0 0 auto;
        }

        .v {
          flex: 1 1 auto;
          min-width: 0;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
          letter-spacing: 0.02em;
        }

        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
          }

          /* печатаем только наши этикетки */
          body * { visibility: hidden !important; }
          .label-root, .label-root * { visibility: visible !important; }

          .label-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
          }

          /* каждая этикетка — отдельная страница */
          .label-58x40 {
            page-break-after: always;
            break-after: page;
          }
          .label-58x40:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>

      {orders.map((o) => (
        <OneLabelHTML key={o.id} order={o} />
      ))}
    </div>
  );
}