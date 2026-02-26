// src/app/layout.tsx
"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TopMarquee from "@/components/TopMarquee";
import CookieBanner from "@/components/CookieBanner";
import { Kanit, Brygada_1918 } from "next/font/google";
import Head from "next/head";  // Подключаем Head

export const dynamic = "force-dynamic";

// ✅ один источник Kanit для всего проекта
export const kanitBold = Kanit({
  subsets: ["latin", "latin-ext"],
  weight: ["700"],
  display: "swap",
});

const brygada = Brygada_1918({
  subsets: ["latin", "latin-ext"],
  weight: ["500"],
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [marquee, setMarquee] = useState<any>(null);

  useEffect(() => {
    const fetchMarquee = async () => {
      const res = await fetch("/api/marquee");
      const data = await res.json();
      setMarquee(data);
    };
    fetchMarquee();

    // Яндекс.Метрика (добавление скрипта через useEffect)
    if (typeof window !== "undefined") {
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.innerHTML = `
        (function(m,e,t,r,i,k,a){
          m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
          m[i].l=1*new Date();
          for (var j = 0; j < document.scripts.length; j++) {
            if (document.scripts[j].src === r) { return; }
          }
          k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
        })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=107021293', 'ym');

        ym(107021293, 'init', {
          ssr:true,
          webvisor:true, 
          clickmap:true, 
          ecommerce:"dataLayer", 
          referrer: document.referrer, 
          url: location.href, 
          accurateTrackBounce:true, 
          trackLinks:true
        });
      `;
      document.head.appendChild(script);
    }
  }, []); // Пустой массив зависимостей для выполнения только на клиенте

  const enabled = marquee?.enabled ?? true;
  const text = marquee?.text ?? "СКИДКИ 20%";
  const speedSeconds = marquee?.speedSeconds ?? 100;

  return (
    <html lang="ru" className="h-full">
      <body
        className={`min-h-screen flex flex-col bg-white text-black ${kanitBold.className}`}
      >
        {/* Яндекс.Метрика */}
        <Head>
          <noscript>
            <div>
              <img src="https://mc.yandex.ru/watch/107021293" alt="" />
            </div>
          </noscript>
        </Head>

        {enabled && (
          <TopMarquee
            text={text}
            speedSeconds={speedSeconds}
            fontClass={brygada.className}
          />
        )}
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />

        {/* ✅ Плашка cookie отображается на всех страницах */}
        <CookieBanner />
      </body>
    </html>
  );
}