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
    let session: any = null;

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

        // Мы используем orderId = draftId.
        // Важно: в Merchant Console ты задашь Callback URL prefix, например:
        // https://your-domain.ru/yandex-pay
        // Тогда Yandex Pay будет дергать:
        // /yandex-pay/v1/order/render, /yandex-pay/v1/order/create, /yandex-pay/v1/webhook :contentReference[oaicite:2]{index=2}

        const paymentData = {
          // версия 3 — “оплата в форме Yandex Pay, результат возвращается мерчанту”
          // (пример в доках по Web SDK guide) :contentReference[oaicite:3]{index=3}
          env:
            process.env.NEXT_PUBLIC_YAPAY_ENV === "PRODUCTION"
              ? YaPay.PaymentEnv.Production
              : YaPay.PaymentEnv.Sandbox,
          version: 3,
          currencyCode: YaPay.CurrencyCode.Rub,

          merchantId: process.env.NEXT_PUBLIC_YAPAY_MERCHANT_ID,

          // “оплачиваемый orderId” — у нас это draftId
          orderId: draftId,

          // можно передать метадату (короткую)
          metadata: "satl",
        };

        function onSuccess(e: any) {
          // оплата успешна по мнению SDK → показываем экран успеха,
          // а реальное создание Order сделает webhook.
          router.push("/pay/success/" + draftId);
        }

        function onError(e: any) {
          setErr("Оплата сейчас недоступна. Попробуйте позже.");
          console.log("YaPay error:", e?.reason);
        }

        function onAbort() {
          // пользователь закрыл форму
        }

        session = await YaPay.createSession(paymentData, { onSuccess, onError, onAbort });

        if (ref.current) {
          session.mountButton(ref.current, {
            type: YaPay.ButtonType.Checkout,
            theme: YaPay.ButtonTheme.Black,
            width: YaPay.ButtonWidth.Auto,
          });
        }
      } catch (e: any) {
        setErr(e?.message || "Ошибка инициализации Yandex Pay");
      }
    }

    init();

    return () => {
      cancelled = true;
      try {
        if (session?.destroy) session.destroy();
      } catch {}
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [draftId, router]);

  return (
    <div>
      <div ref={ref} id="button_container" />
      {err ? <div className="mt-3 text-[12px] text-[#B60404]">{err}</div> : null}
    </div>
  );
}