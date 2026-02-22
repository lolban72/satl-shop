"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { X, Menu, ChevronDown } from "lucide-react";

type NavCategory = { id: string; title: string; slug: string };
type InfoLink = { href: string; label: string };

export default function MobileNav(props: {
  categories: NavCategory[];
  infoLinks: InfoLink[];
  isAuthed: boolean; // ✅ добавили
}) {
  const { categories, infoLinks, isAuthed } = props;

  const [open, setOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(true); // ✅ добавили

  const cats = useMemo(() => categories ?? [], [categories]);

  function close() {
    setOpen(false);
  }

  return (
    <>
      {/* Burger (visible on mobile only) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Открыть меню"
        className="md:hidden inline-flex items-center justify-center hover:opacity-70 transition"
      >
        <Menu size={34} strokeWidth={2} />
      </button>

      {/* Overlay */}
      <div
        className={[
          "fixed inset-0 z-[60] md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
        aria-hidden={!open}
      >
        {/* Backdrop */}
        <div
          onClick={close}
          className={[
            "absolute inset-0 bg-black/35 transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />

        {/* Panel */}
        <aside
          className={[
            "absolute right-0 top-0 h-full w-[86vw] max-w-[380px]",
            "bg-white border-l border-black/10",
            "shadow-[0_18px_55px_rgba(0,0,0,0.18)]",
            "transition-transform duration-200",
            open ? "translate-x-0" : "translate-x-full",
          ].join(" ")}
        >
          {/* Header */}
          <div className="h-[72px] px-[18px] flex items-center justify-between">
            <div className="text-[13px] font-bold uppercase tracking-[0.06em] text-black/70" />
            <button
              type="button"
              onClick={close}
              aria-label="Закрыть меню"
              className="inline-flex items-center justify-center hover:opacity-70 transition"
            >
              <X size={25} strokeWidth={2} />
            </button>
          </div>

          {/* Body */}
          <div className="px-[18px] py-[6px]">
            {/* Accordion: Categories */}
            <button
              type="button"
              onClick={() => setCatsOpen((v) => !v)}
              className="w-full flex items-center justify-between py-[12px] text-left"
            >
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-black/100">
                Категории
              </span>
              <ChevronDown
                size={18}
                strokeWidth={2}
                className={[
                  "transition-transform",
                  catsOpen ? "rotate-180" : "rotate-0",
                ].join(" ")}
              />
            </button>

            <div
              className={[
                "overflow-hidden transition-[max-height,opacity] duration-200",
                catsOpen ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0",
              ].join(" ")}
            >
              <div className="pb-[10px]">
                {cats.length === 0 ? (
                  <div className="py-[10px] text-[11px] uppercase tracking-[0.08em] text-black/45">
                    Нет категорий
                  </div>
                ) : (
                  <div className="grid">
                    {cats.map((c) => (
                      <Link
                        key={c.id}
                        href={`/#cat-${c.slug}`}
                        onClick={close}
                        className="py-[12px] border-t border-black/10 text-[12px] font-semibold uppercase tracking-[0.06em] text-black/75 hover:text-black hover:bg-black/5 px-[10px] transition"
                      >
                        {c.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="h-[1px] bg-black/10" />

            {/* Accordion: Info */}
            <button
              type="button"
              onClick={() => setInfoOpen((v) => !v)}
              className="w-full flex items-center justify-between py-[12px] text-left"
            >
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-black/100">
                Информация
              </span>
              <ChevronDown
                size={18}
                strokeWidth={2}
                className={[
                  "transition-transform",
                  infoOpen ? "rotate-180" : "rotate-0",
                ].join(" ")}
              />
            </button>

            <div
              className={[
                "overflow-hidden transition-[max-height,opacity] duration-200",
                infoOpen ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0",
              ].join(" ")}
            >
              <div className="pb-[10px]">
                <div className="grid">
                  {infoLinks.map((x) => (
                    <Link
                      key={x.href}
                      href={x.href}
                      onClick={close}
                      className="py-[12px] border-t border-black/10 text-[12px] font-semibold uppercase tracking-[0.06em] text-black/75 hover:text-black hover:bg-black/5 px-[10px] transition"
                    >
                      {x.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-[1px] bg-black/10" />

            {/* ✅ Accordion: Profile */}
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="w-full flex items-center justify-between py-[12px] text-left"
            >
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-black/100">
                Профиль
              </span>
              <ChevronDown
                size={18}
                strokeWidth={2}
                className={[
                  "transition-transform",
                  profileOpen ? "rotate-180" : "rotate-0",
                ].join(" ")}
              />
            </button>

            <div
              className={[
                "overflow-hidden transition-[max-height,opacity] duration-200",
                profileOpen ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0",
              ].join(" ")}
            >
              <div className="pb-[10px]">
                <div className="grid">
                  {isAuthed ? (
                    <>
                      <Link
                        href="/account/orders"
                        onClick={close}
                        className="py-[12px] border-t border-black/10 text-[12px] font-semibold uppercase tracking-[0.06em] text-black/75 hover:text-black hover:bg-black/5 px-[10px] transition"
                      >
                        Заказы
                      </Link>

                      <Link
                        href="/account/profile"
                        onClick={close}
                        className="py-[12px] border-t border-black/10 text-[12px] font-semibold uppercase tracking-[0.06em] text-black/75 hover:text-black hover:bg-black/5 px-[10px] transition"
                      >
                        Личные данные
                      </Link>

                      <Link
                        href="/account/address"
                        onClick={close}
                        className="py-[12px] border-t border-black/10 text-[12px] font-semibold uppercase tracking-[0.06em] text-black/75 hover:text-black hover:bg-black/5 px-[10px] transition"
                      >
                        Адрес доставки
                      </Link>

                      <Link
                        href="/account/subscriptions"
                        onClick={close}
                        className="py-[12px] border-t border-black/10 text-[12px] font-semibold uppercase tracking-[0.06em] text-black/75 hover:text-black hover:bg-black/5 px-[10px] transition"
                      >
                        Подписки
                      </Link>

                    <form action="/auth/logout" method="POST" className="border-t border-black/10">
                    <button
                        type="submit"
                        onClick={close}
                        className="w-full text-left py-[12px] text-[12px] font-semibold uppercase tracking-[0.06em] text-black/75 hover:text-black hover:bg-black/5 px-[10px] transition"
                    >
                        Выход
                    </button>
                    </form>
                    </>
                  ) : (
                    <Link
                      href="/auth/login"
                      onClick={close}
                      className="py-[12px] border-t border-black/10 text-[12px] font-semibold uppercase tracking-[0.06em] text-black/75 hover:text-black hover:bg-black/5 px-[10px] transition"
                    >
                      Регистрация/вход
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
