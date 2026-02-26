"use client";

import Script from "next/script";

export default function YandexMetrika() {
  return (
    <>
      {/* Загружаем скрипт Яндекс.Метрики асинхронно */}
      <Script
        strategy="afterInteractive" // Загружаем после того, как страница станет интерактивной
        src="https://mc.yandex.ru/metrika/tag.js?id=107021293"
        onLoad={() => {
          if (window.ym) {
            window.ym(107021293, 'init', {
              ssr: true,
              webvisor: true,
              clickmap: true,
              ecommerce: "dataLayer",
              referrer: document.referrer,
              url: location.href,
              accurateTrackBounce: true,
              trackLinks: true,
            });
          }
        }}
      />
    </>
  );
}