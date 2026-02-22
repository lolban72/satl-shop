"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export default function OrderBarcodePrint({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        width: 2,
        height: 60,
        displayValue: true,
      });
    }
  }, [value]);

  function print() {
    window.print();
  }

  return (
    <div className="space-y-4">
      <svg ref={ref}></svg>

      <button
        onClick={print}
        className="rounded-xl bg-black px-4 py-2 text-sm text-white"
      >
        Печать наклейки
      </button>
    </div>
  );
}