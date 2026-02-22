import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { User, ShoppingBag, ChevronDown } from "lucide-react";
import MobileNav from "@/components/header/MobileNav"; // путь подстрой под себя
import { auth } from "@/auth"; // ✅ ДОБАВИЛИ

function Dropdown({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group">
      <div className="inline-flex items-center gap-[8px] hover:opacity-70 transition">
        {label}
        <ChevronDown size={14} strokeWidth={2} className="translate-y-[1px]" />
      </div>

      <div
        className="
          absolute left-0 top-full z-50
          pt-[14px]
          opacity-0 pointer-events-none translate-y-[-6px]
          group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0
          transition duration-200
        "
      >
        <div
          className="
            w-[320px]
            border border-black/15 bg-white
            shadow-[0_18px_55px_rgba(0,0,0,0.12)]
          "
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function DropdownItem({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="
        block px-[18px] py-[12px]
        text-[12px] font-semibold uppercase tracking-[0.06em]
        text-black/80
        hover:text-black hover:bg-black/5
        transition
      "
    >
      {children}
    </Link>
  );
}

export default async function Header({ className = "" }: { className?: string }) {
  const session = await auth(); // ✅ ДОБАВИЛИ

  const categories = await prisma.category.findMany({
    where: { showInNav: true, products: { some: {} } },
    orderBy: [{ navOrder: "asc" }, { title: "asc" }],
    select: { id: true, title: true, slug: true },
  });

  const infoLinks = [
    { href: "/docs/delivery", label: "Доставка и оплата" },
    { href: "/docs/returns", label: "Обмен и возврат" },
    { href: "/docs/public-offer", label: "Публичная оферта" },
    { href: "/docs/user-agreement", label: "Пользовательское соглашение" },
    { href: "/docs/privacy-policy", label: "Политика конфиденциальности" },
    { href: "/docs/pd-policy", label: "Политика обработки ПД" },
  ];

  return (
    <header className={`sticky top-0 z-50 bg-white text-black ${className}`}>
      <div
        className="
          mx-auto flex h-[80px] max-w-[1440px] items-center
          px-[16px] md:px-[65px]
        "
      >
        {/* LEFT GROUP */}
        <div className="flex items-center gap-[14px] md:gap-[100px]">
          {/* LOGO */}
          <Link
            href="/"
            className="
              font-bold leading-none tracking-[-0.19em]
              text-[60px] md:text-[65px]
            "
          >
            SATL
          </Link>

          {/* DESKTOP NAV */}
          <nav className="hidden md:flex items-center gap-[33px] font-bold text-[15px] uppercase tracking-[-0.02em]">
            <Dropdown
              label={
                <Link href="/#catalog" className="hover:opacity-70 transition">
                  Категории
                </Link>
              }
            >
              <div className="py-[6px]">
                {categories.length === 0 ? (
                  <div className="px-[18px] py-[12px] text-[11px] uppercase tracking-[0.08em] text-black/45">
                    Нет категорий
                  </div>
                ) : (
                  categories.map((c, idx) => (
                    <div key={c.id}>
                      <DropdownItem href={`/#cat-${c.slug}`}>{c.title}</DropdownItem>
                      {idx !== categories.length - 1 ? (
                        <div className="h-[1px] bg-black/10 mx-[18px]" />
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </Dropdown>

            {categories.map((c) => (
              <Link key={c.id} href={`/#cat-${c.slug}`} className="hover:opacity-70 transition">
                {c.title}
              </Link>
            ))}

            <Dropdown label={<span className="cursor-default">Информация</span>}>
              <div className="py-[6px]">
                {infoLinks.map((x, idx) => (
                  <div key={x.href}>
                    <DropdownItem href={x.href}>{x.label}</DropdownItem>
                    {idx !== infoLinks.length - 1 ? (
                      <div className="h-[1px] bg-black/10 mx-[18px]" />
                    ) : null}
                  </div>
                ))}
              </div>
            </Dropdown>
          </nav>
        </div>

        {/* RIGHT ICONS */}
        <div className="ml-auto flex items-center gap-[18px] md:gap-[16px]">
          <Link href="/account/orders" aria-label="Профиль" className="hover:opacity-70 transition">
            <User size={30} strokeWidth={2} />
          </Link>

          <Link href="/cart" aria-label="Корзина" className="hover:opacity-70 transition">
            <ShoppingBag size={30} strokeWidth={2} />
          </Link>

          {/* MOBILE MENU */}
          <MobileNav
            categories={categories}
            infoLinks={infoLinks}
            isAuthed={!!session?.user} // ✅ теперь session существует
          />
        </div>
      </div>
    </header>
  );
}
