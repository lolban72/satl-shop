"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    YaPay?: any;
  }
}

export default function YaPayButton({ draftId }: { draftId: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let paymentSession: any = null;

    const loadSdk = () =>
      new Promise<void>((resolve, reject) => {
        if (window.YaPay) return resolve();
        const s = document.createElement("script");
        s.src = "https://pay.yandex.ru/sdk/v1/pay.js";
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Не удалось загрузить Yandex Pay SDK"));
        document.body.appendChild(s);
      });

    async function init() {
      setErr(null);

      try {
        await loadSdk();
        if (cancelled) return;

        const YaPay = window.YaPay;
        if (!YaPay) throw new Error("YaPay недоступен");

        const merchantId = process.env.NEXT_PUBLIC_YAPAY_MERCHANT_ID;
        if (!merchantId) {
          throw new Error(
            "Не задан NEXT_PUBLIC_YAPAY_MERCHANT_ID (env переменная не попала в build)"
          );
        }

        // Берём итоговую сумму с бэка по draftId (чтобы totalAmount был реальным)
        const sumRes = await fetch(`/api/pay/status?draftId=${encodeURIComponent(draftId)}`);
        const sumData = await sumRes.json().catch(() => ({}));
        if (!sumRes.ok) throw new Error(sumData?.error || "Не удалось получить сумму заказа");

        const totalAmount = String(sumData?.totalAmount ?? "").trim();
        if (!totalAmount) throw new Error("totalAmount пустой");

        const paymentData = {
          env:
            process.env.NEXT_PUBLIC_YAPAY_ENV === "PRODUCTION"
              ? YaPay.PaymentEnv.Production
              : YaPay.PaymentEnv.Sandbox,

          // ✅ актуальный сценарий "оплата на форме Yandex Pay"
          version: 4,

          countryCode: YaPay.CountryCode.Ru,
          currencyCode: YaPay.CurrencyCode.Rub,

          merchantId,
          totalAmount,

          // внешний вид кнопки/доступные способы
          availablePaymentMethods: ["CARD", "SPLIT"],

          // если используешь API flow с /order/render по orderId — можно передать orderId
          orderId: draftId,
        };

        // В этом сценарии по клику мы просто открываем форму.
        // Если Яндекс не сможет открыть форму — вызовется onFormOpenError.
        async function onPayButtonClick() {
          const res = await fetch("/api/pay/yapay/link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ draftId }),
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            console.log("YaPay link error:", data);
            throw new Error(data?.error || "Не удалось получить ссылку оплаты");
          }

          return data.paymentUrl; // ✅ критично
        }

        function onFormOpenError(e: any) {
          console.log("YaPay onFormOpenError:", e);
          setErr("Что-то пошло не так при открытии формы оплаты. Попробуйте ещё раз.");
        }

        paymentSession = await YaPay.createSession(paymentData, {
          onPayButtonClick,
          onFormOpenError,
        });

        if (ref.current) {
          paymentSession.mountButton(ref.current, {
            type: YaPay.ButtonType.Pay,
            theme: YaPay.ButtonTheme.Black,
            width: YaPay.ButtonWidth.Auto,
          });
        }
      } catch (e: any) {
        console.log("YaPay init error:", e);
        setErr(e?.message || "Ошибка инициализации Yandex Pay");
      }
    }

    init();

    return () => {
      cancelled = true;
      try {
        paymentSession?.destroy?.();
      } catch {}
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [draftId]);

  return (
    <div>
      <div ref={ref} />
      {err ? <div className="mt-3 text-[12px] text-[#B60404]">{err}</div> : null}
    </div>
  );
}