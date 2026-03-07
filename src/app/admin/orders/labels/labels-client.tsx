"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { toPng } from "html-to-image";

function val(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

function cleanTrackNumber(v: any) {
  return String(v ?? "").trim();
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

  const productTitle = val(firstItem?.title);
  const size = val(firstItem?.variant?.size);
  const pvz = val(order?.pvzName || order?.pvzAddress || order?.pvz || order?.pickupPoint || "СДЭК");
  const trackNumber = useMemo(() => cleanTrackNumber(order?.trackNumber), [order?.trackNumber]);

  useEffect(() => {
    if (!barcodeRef.current) return;

    if (!trackNumber) {
      barcodeRef.current.innerHTML = "";
      return;
    }

    JsBarcode(barcodeRef.current, trackNumber, {
      format: "CODE128",
      width: 1.35,
      height: 28,
      displayValue: false,
      margin: 0,
    });
  }, [trackNumber]);

  return (
    <div ref={htmlRef} className="label-58x40">
      <div className="barcode-wrap">
        {trackNumber ? (
          <svg ref={barcodeRef} className="barcode" />
        ) : (
          <div className="barcode-empty">НЕТ ТРЕК-НОМЕРА</div>
        )}
      </div>

      <div className="meta">
        <div className="row row-top">
          <span className="k">Товар:</span>
          <span className="v v-wrap">{productTitle}</span>
        </div>

        <div className="row">
          <span className="k">Размер:</span>
          <span className="v">{size}</span>
        </div>

        <div className="row row-top">
          <span className="k">ПВЗ:</span>
          <span className="v v-wrap">{pvz}</span>
        </div>

        <div className="row">
          <span className="k">Трек:</span>
          <span className="v mono">{trackNumber || "—"}</span>
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
          padding: 1.4mm 1.5mm 1.2mm;
          display: flex;
          flex-direction: column;
          gap: 1mm;
          background: #fff;
          color: #000;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          overflow: hidden;
        }

        .barcode-wrap {
          width: 100%;
          min-height: 9.5mm;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding-top: 0.2mm;
        }

        .barcode {
          width: 54mm;
          height: auto;
          display: block;
        }

        .barcode-empty {
          width: 54mm;
          height: 9mm;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0.2mm dashed #999;
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .meta {
          font-size: 7px;
          line-height: 1.08;
          display: flex;
          flex-direction: column;
          gap: 0.65mm;
          text-align: left;
          min-height: 0;
        }

        .row {
          display: flex;
          gap: 1.6mm;
          align-items: baseline;
          justify-content: flex-start;
          min-width: 0;
        }

        .row-top {
          align-items: flex-start;
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

        .v-wrap {
          white-space: normal;
          overflow: hidden;
          text-overflow: clip;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          line-clamp: 2;
          word-break: break-word;
        }

        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
          letter-spacing: 0.01em;
          font-size: 6.8px;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }

          .label-root,
          .label-root * {
            visibility: visible !important;
          }

          html,
          body {
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
            key={o.id ?? i}
            order={o}
            htmlRef={(el) => {
              refs.current[i] = el;
            }}
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