"use client";

import { useEffect, useMemo, useRef } from "react";
import JsBarcode from "jsbarcode";

function val(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

function shortId(id: any) {
  const s = String(id ?? "");
  return s.length > 10 ? s.slice(0, 10) + "…" : s;
}

function OneLabel({ order }: any) {
  const ref = useRef<SVGSVGElement | null>(null);

  const firstItem = useMemo(() => {
    const items = Array.isArray(order?.items) ? order.items : [];
    return items[0] ?? null;
  }, [order?.items]);

  const size = val(firstItem?.variant?.size);

  useEffect(() => {
    if (!ref.current) return;

    // ✅ Под 58mm ширину: тоньше линии и ниже высота
    JsBarcode(ref.current, String(order?.id ?? ""), {
      format: "CODE128",
      width: 1.2,      // толщина линии
      height: 22,      // высота штрих-кода (мм-наклейка маленькая)
      displayValue: false,
      margin: 0,
    });
  }, [order?.id]);

  return (
    <div className="label-page">
      <div className="label">
        <svg ref={ref} className="barcode" />
        <div className="meta">
          <div className="row">
            <span className="k">ID:</span> <span className="v mono">{shortId(order?.id)}</span>
          </div>
          <div className="row">
            <span className="k">SIZE:</span> <span className="v">{size}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LabelsClient({ orders }: { orders: any[] }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 250);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="label-root">
      <style>{`
        /* ✅ ВАЖНО: размер страницы = размер наклейки */
        @page {
          size: 58mm 40mm;
          margin: 0;
        }

        /* Базовая разметка на экране */
        .label-root { padding: 0; margin: 0; }
        .label-page { width: 58mm; height: 40mm; }
        .label {
          width: 58mm;
          height: 40mm;
          box-sizing: border-box;
          padding: 2mm 2mm 1.5mm 2mm;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          gap: 1.5mm;
          color: #000;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        }
        .barcode { width: 100%; height: auto; }
        .meta { font-size: 9px; line-height: 1.15; }
        .row { display: flex; gap: 2mm; }
        .k { font-weight: 700; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }

        @media print {
          /* ✅ Печатаем ТОЛЬКО наклейки */
          body * { visibility: hidden !important; }
          .label-root, .label-root * { visibility: visible !important; }

          html, body { margin: 0 !important; padding: 0 !important; }
          .label-root { position: absolute !important; left: 0 !important; top: 0 !important; }

          /* ✅ Каждая наклейка = отдельная страница/стикер */
          .label-page { break-after: page; page-break-after: always; }
          .label-page:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>

      {orders.map((o) => (
        <OneLabel key={o.id} order={o} />
      ))}
    </div>
  );
}