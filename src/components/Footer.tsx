"use client";

import { useEffect, useMemo, useState } from "react";
import { akonyBold } from "@/lib/fonts";
import Link from "next/link";

function buildSatlLine(count: number) {
  return Array.from({ length: count }, () => "SATL").join(" ");
}

type ContactItem = { label: string; href: string };

const DEFAULT_CONTACTS_LEFT: ContactItem[] = [
  { label: "телеграм", href: "https://web.telegram.org/k/#@MANAGER_SATL_SHOP" },
  { label: "почта", href: "mailto:Satl.Shop.ru@gmail.com" },
  { label: "тикток", href: "#" },
];

const DEFAULT_CONTACTS_RIGHT: ContactItem[] = [
  { label: "инстаграм", href: "#" },
  { label: "телефон", href: "tel:+70000000000" },
  { label: "вк", href: "#" },
];

export default function Footer() {
  const [count, setCount] = useState(6);

  // subscribe state
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subOk, setSubOk] = useState<string | null>(null);
  const [subErr, setSubErr] = useState<string | null>(null);

  // ✅ contacts state (from admin settings)
  const [contactsLeft, setContactsLeft] = useState<ContactItem[]>(
    DEFAULT_CONTACTS_LEFT
  );
  const [contactsRight, setContactsRight] = useState<ContactItem[]>(
    DEFAULT_CONTACTS_RIGHT
  );

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

  // ✅ load contacts once
  useEffect(() => {
    let cancelled = false;

    async function loadContacts() {
      try {
        const res = await fetch("/api/site-settings/contacts", {
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) return;
        if (cancelled) return;

        if (Array.isArray(data.left)) setContactsLeft(data.left);
        if (Array.isArray(data.right)) setContactsRight(data.right);
      } catch {
        // keep defaults
      }
    }

    loadContacts();
    return () => {
      cancelled = true;
    };
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

            <div className="mt-[10px] flex gap-x-[80px]" style={{ fontFamily: "Yeast" }}>
              <div className="flex flex-col gap-y-[6px] text-[9px] leading-[1.2] uppercase tracking-[0.02em] text-black/80" >
                <Link
                  href="/docs/user-agreement"
                  className="hover:text-black transition"
                >
                  пользовательское соглашение
                </Link>
                <Link
                  href="/docs/pd-policy"
                  className="hover:text-black transition"
                >
                  политика обработки персональных данных
                </Link>
                <Link
                  href="/docs/privacy-policy"
                  className="hover:text-black transition"
                >
                  политика конфиденциальности
                </Link>
              </div>

              <div className="flex flex-col gap-y-[6px] text-[9px] leading-[1.2] uppercase tracking-[0.02em] text-black/80">
                <Link
                  href="/docs/delivery"
                  className="hover:text-black transition"
                >
                  доставка и оплата
                </Link>
                <Link href="/docs/returns" className="hover:text-black transition">
                  обмен и возврат
                </Link>
                <Link
                  href="/docs/public-offer"
                  className="hover:text-black transition"
                >
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

            <div className="mt-[10px] flex gap-x-[48px]" style={{ fontFamily: "Yeast" }}>
              {/* Левая колонка */}
              <div className="flex flex-col gap-y-[6px] text-[9px] leading-[1.2] uppercase tracking-[0.02em] text-black/80">
                {contactsLeft.map((it, idx) => (
                  <a
                    key={`${it.label}-${idx}`}
                    href={it.href}
                    className="hover:text-black transition"
                  >
                    {it.label}
                  </a>
                ))}
              </div>

              {/* Правая колонка */}
              <div className="flex flex-col gap-y-[6px] text-[9px] leading-[1.2] uppercase tracking-[0.02em] text-black/80">
                {contactsRight.map((it, idx) => (
                  <a
                    key={`${it.label}-${idx}`}
                    href={it.href}
                    className="hover:text-black transition"
                  >
                    {it.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Подписка */}
          <div className="col-span-4">
            <div className="font-bold italic text-[20px] leading-none tracking-[-0.05em]">
              Подписаться
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
      <div className="mt-auto w-full overflow-hidden">
        <div
          className={`
            ${akonyBold.className}
            whitespace-nowrap uppercase leading-none
            text-[60px] md:text-[100px]
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