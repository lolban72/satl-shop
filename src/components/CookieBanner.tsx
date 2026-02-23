"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function CookieBanner() {
  const [mounted, setMounted] = useState(false); // чтобы не мигало на SSR
  const [visible, setVisible] = useState(false); // управляет анимацией
  const [render, setRender] = useState(false); // управляет тем, есть ли баннер в DOM

  useEffect(() => {
    setMounted(true);
    const accepted = localStorage.getItem("cookieAccepted");
    if (!accepted) {
      setRender(true); // сначала монтируем
      // затем включаем анимацию появления
      requestAnimationFrame(() => setVisible(true));
    }
  }, []);

  function accept() {
    localStorage.setItem("cookieAccepted", "true");
    // запускаем анимацию исчезновения
    setVisible(false);
    // удаляем из DOM после завершения transition
    window.setTimeout(() => setRender(false), 260);
  }

  if (!mounted || !render) return null;

  return (
    <div
      className={[
        "fixed bottom-0 left-0 right-0 z-[200] bg-black text-white",
        "px-4 py-3 text-[12px]",
        "transition-all duration-300 ease-out",
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none",
      ].join(" ")}
    >
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="leading-[1.4]">
          Продолжая пользоваться сайтом, вы соглашаетесь с использованием и{" "}
          <Link
            href="/docs/cookie-policy"
            className="underline hover:text-gray-300 transition"
          >
            обработкой файлов-cookie
          </Link>
          .
        </div>

        <button
          onClick={accept}
          className="border border-white/40 px-4 py-2 text-[10px] uppercase tracking-[0.1em] hover:bg-white hover:text-black transition"
        >
          Принять
        </button>
      </div>
    </div>
  );
}