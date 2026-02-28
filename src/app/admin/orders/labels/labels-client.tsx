"use client";

import { useEffect, useMemo, useRef } from "react";
import JsBarcode from "jsbarcode";

function val(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

function OneLabel({ order }: any) {
  const ref = useRef<SVGSVGElement | null>(null);

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
    if (!ref.current) return;
    JsBarcode(ref.current, String(order?.id ?? ""), {
      format: "CODE128",
      width: 2,
      height: 70,
      displayValue: false,
      margin: 0,
    });
  }, [order?.id]);

  return (
    <div className="label-page">
      <div className="print-area w-[180mm] p-4 text-black">
        {/* BARCODE */}
        <div className="w-full flex justify-center">
          <svg ref={ref} className="w-full" />
        </div>

        {/* FIELDS */}
        <div
          className="mt-6 space-y-3 text-[18px] leading-[1.2]"
          style={{ fontFamily: "Brygada" }}
        >
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

      {/* разрыв страницы */}
      <div className="page-break" />
    </div>
  );
}

export default function LabelsClient({ orders }: { orders: any[] }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="label-root">
      <style>{`
        @media print {
          /* ✅ скрываем вообще всё на странице */
          body * { visibility: hidden; }

          /* ✅ показываем только этикетки */
          .label-root, .label-root * { visibility: visible; }

          /* убираем отступы */
          body { margin: 0 !important; padding: 0 !important; }

          /* печатная область — в левом верхнем углу */
          .label-root { position: absolute; left: 0; top: 0; width: 100%; }

          /* разрыв страницы между этикетками */
          .page-break { page-break-after: always; }
        }

        /* На экране можно оставить как есть */
      `}</style>

      {orders.map((o) => (
        <OneLabel key={o.id} order={o} />
      ))}
    </div>
  );
}