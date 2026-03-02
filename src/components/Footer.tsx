"use client";

import { useEffect, useMemo, useState } from "react";
import { akonyBold } from "@/lib/fonts";
import Link from "next/link";

function buildSatlLine(count: number) {
  return Array.from({ length: count }, () => "SATL").join(" ");
}

export default function Footer() {
  const [count, setCount] = useState(6);

  // subscribe state
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subOk, setSubOk] = useState<string | null>(null);
  const [subErr, setSubErr] = useState<string | null>(null);

  useEffect(() => {
    const recalc = () => {
      const w = window.innerWidth;
      const approxWord = 240;
      setCount(Math.max(6, Math.ceil(w / approxWord) + 2));
    };
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);

  const line = useMemo(() => buildSatlLine(count), [count]);

  async function subscribe() {
    setSubmitting(true);
    setSubOk(null);
    setSubErr(null);

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Не удалось подписаться");

      setSubOk("Вы подписаны ✅ (отображается в личном кабинете)");
      setEmail("");
    } catch (e: any) {
      setSubErr(e?.message || "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <footer className="bg-white text-black mt-[120px] flex flex-col">
      {/* ===== ВЕРХ ФУТЕРА ===== */}
      {/* ❗ На мобилке скрываем полностью */}
      <div className="hidden md:block mx-auto w-full max-w-[1440px] px-[15px]">
        <div className="grid grid-cols-12 items-start">
          {/* Покупателям */}
          <div className="col-span-5">
            <div className="font-bold italic text-[20px] leading-none tracking-[-0.05em]">
              Покупателям
            </div>

            <div className="mt-[10px] flex gap-x-[80px]">
              <div className="flex flex-col gap-y-[6px] text-[9px] leading-[1.2] uppercase tracking-[0.02em] text-black/80">
                <Link href="/docs/user-agreement" className="hover:text-black transition">
                  пользовательское соглашение
                </Link>
                <Link href="/docs/pd-policy" className="hover:text-black transition">
                  политика обработки персональных данных
                </Link>
                <Link href="/docs/privacy-policy" className="hover:text-black transition">
                  политика конфиденциальности
                </Link>
              </div>

              <div className="flex flex-col gap-y-[6px] text-[9px] leading-[1.2] uppercase tracking-[0.02em] text-black/80">
                <Link href="/docs/delivery" className="hover:text-black transition">
                  доставка и оплата
                </Link>
                <Link href="/docs/returns" className="hover:text-black transition">
                  обмен и возврат
                </Link>
                <Link href="/docs/public-offer" className="hover:text-black transition">
                  публичная оферта
                </Link>
              </div>
            </div>
          </div>

          {/* Контакты */}
          <div className="col-span-3">
            <div className="font-bold italic text-[20px] leading-none tracking-[-0.05em]">
              Контакты
            </div>

            <div className="mt-[10px] flex gap-x-[48px]">
              <div className="flex flex-col gap-y-[6px] text-[9px] leading-[1.2] uppercase tracking-[0.02em] text-black/80">
                <a href="https://web.telegram.org/k/#@MANAGER_SATL_SHOP" className="hover:text-black transition">телеграм</a>
                <a href="mailto:Satl.Shop.ru@gmail.com" className="hover:text-black transition">почта</a>
                <a href="#" className="hover:text-black transition">тикток</a>
              </div>
              <div className="flex flex-col gap-y-[6px] text-[9px] leading-[1.2] uppercase tracking-[0.02em] text-black/80">
              </div>
            </div>
          </div>

          {/* Подписка */}
          <div className="col-span-4">
            <div className="font-bold italic text-[20px] leading-none tracking-[-0.05em]">
              Подписаться на рассылку
            </div>

            <div className="mt-[12px] flex items-center gap-[16px]">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ваш E-mail*"
                className="
                  h-[32px] w-[220px]
                  border border-[#BFBFBF]
                  px-[10px]
                  text-[11px] tracking-[0.02em]
                  outline-none
                  placeholder:text-black/50
                  focus:border-black transition
                "
              />

              <button
                type="button"
                disabled={submitting}
                onClick={subscribe}
                className="
                  h-[32px] px-[28px]
                  bg-black text-white
                  text-[11px] font-bold uppercase tracking-[0.02em]
                  transition hover:bg-[#111]
                  active:scale-[0.98]
                  disabled:opacity-40 disabled:cursor-not-allowed
                "
              >
                {submitting ? "..." : "подписаться"}
              </button>
            </div>

            {subOk ? (
              <div className="mt-[6px] text-[9px] italic leading-[1.4] text-black/70">
                {subOk}
              </div>
            ) : null}

            {subErr ? (
              <div className="mt-[6px] text-[9px] italic leading-[1.4] text-[#B60404]">
                {subErr}
              </div>
            ) : (
              <div className="mt-[6px] text-[9px] italic leading-[1.4] text-black/70">
                *Нажав на кнопку “Подписаться”, Вы соглашаетесь с{" "}
                <Link
                  href="/docs/pd-policy"
                  target="_blank"
                  className="border-b border-black/40 text-black hover:border-black transition"
                >
                  политикой обработки персональных данных
                </Link>{" "}
                и даёте{" "}
                <Link
                  href="/legal/consent"
                  target="_blank"
                  className="border-b border-black/40 text-black hover:border-black transition"
                >
                  согласие на обработку персональных данных
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== НИЖНИЙ SATL ===== */}
      {/* ===== НИЖНИЙ SATL ===== */}
      <div className="mt-auto w-full overflow-hidden">
        <div
          className={`
            ${akonyBold.className}
            whitespace-nowrap uppercase leading-none
            text-[60px] md:text-[100px]   // 👈 меньше на телефоне
            tracking-[-0.30em]
            translate-y-[14px] md:translate-y-[22px]
          `}
        >
          {line}
        </div>
      </div>

    </footer>
  );
}
