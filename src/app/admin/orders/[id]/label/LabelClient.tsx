"use client";

import { useEffect, useMemo, useRef } from "react";
import JsBarcode from "jsbarcode";

function val(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

export default function LabelClient({ order }: any) {
  const ref = useRef<SVGSVGElement | null>(null);

  const firstItem = useMemo(() => {
    const items = Array.isArray(order?.items) ? order.items : [];
    return items[0] ?? null;
  }, [order?.items]);

  const productTitle = val(firstItem?.title);

  // ✅ Размер берем из variant (variant должен быть включён на сервере)
  const size = val(firstItem?.variant?.size);

  // ✅ У тебя в Order есть address — используем его как ПВЗ/адрес доставки
  const pvz = val(order?.address);

  // ✅ Трека пока нет
  const track = val(order?.track ?? order?.trackingNumber ?? order?.trackNumber ?? order?.tracking ?? order?.trackId);

  useEffect(() => {
    if (ref.current) {
      JsBarcode(ref.current, String(order?.id ?? ""), {
        format: "CODE128",
        width: 2,
        height: 70,
        displayValue: false,
        margin: 0,
      });
    }

    const t = setTimeout(() => {
      window.print();
    }, 300);

    return () => clearTimeout(t);
  }, [order?.id]);

  return (
    <div className="label-page">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; }
          body { margin: 0; }
        }
      `}</style>

      <div className="print-area w-[180mm] p-4 text-black">
        {/* BARCODE */}
        <div className="w-full flex justify-center">
          <svg ref={ref} className="w-full" />
        </div>

        {/* FIELDS */}
        <div className="mt-6 space-y-3 text-[18px] leading-[1.2]" style={{ fontFamily: "Brygada" }}>
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
    </div>
  );
}