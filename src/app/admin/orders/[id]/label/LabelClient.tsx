"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export default function LabelClient({ order }: any) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      JsBarcode(ref.current, order.id, {
        format: "CODE128",
        width: 2,
        height: 70,
        displayValue: true,
      });
    }

    setTimeout(() => {
      window.print();
    }, 300);
  }, [order.id]);

  return (
    <div className="label-page">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }

          .print-area, .print-area * {
            visibility: visible;
          }

          .print-area {
            position: absolute;
            left: 0;
            top: 0;
          }

          body {
            margin: 0;
          }
        }
      `}</style>

      <div className="print-area w-[180mm] border p-4 text-[14px] text-black">
        <div className="text-[16px] font-bold mb-3">
          SATL
        </div>

        <div className="mb-2">
          <div><strong>Получатель:</strong> {order.name}</div>
          <div><strong>Телефон:</strong> {order.phone}</div>
          <div><strong>Адрес:</strong> {order.address}</div>
        </div>

        <div className="mb-3 font-mono text-[12px] break-all">
          {order.id}
        </div>

        <svg ref={ref}></svg>
      </div>
    </div>
  );
}