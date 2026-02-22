import Link from "next/link";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";

function parseAdminEmails(v?: string) {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email?: string | null) {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  const admins = parseAdminEmails(process.env.ADMIN_EMAILS);
  return admins.includes(e);
}

const nav = [
  { href: "/admin", label: "Панель" },
  { href: "/admin/orders", label: "Заказы" },
  { href: "/admin/stats", label: "Статистика" },
  { href: "/admin/products", label: "Товары" },
  { href: "/admin/products/new", label: "Добавить товар" },
  { href: "/admin/categories", label: "Категории" },
  { href: "/admin/navigation/header", label: "Порядок в шапке" },
  { href: "/admin/navigation/home", label: "Порядок на главной" },
  { href: "/admin/marketing/hero", label: "Баннер" },
  { href: "/admin/marquee", label: "Бегущая строка" },
];

// ✅ маленький компонент “та же кнопка, что в дизайне”
function NavItem({ href, label }: { href: string; label: string }) {
  // на сервере активный роут без usePathname недоступен,
  // поэтому делаем стиль везде одинаковым (минимализм).
  // Если хочешь активный пункт — скажи, я дам клиентский sidebar.
  return (
    <Link
      href={href}
      className={[
        "group flex items-center justify-between",
        "rounded-2xl border border-black/15 px-3 py-3",
        "text-[12px] uppercase tracking-[0.08em] font-semibold",
        "text-black/70 hover:text-black hover:border-black/30 hover:bg-black/[0.03] transition",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className="text-black/30 group-hover:text-black/60 transition">→</span>
    </Link>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  // ✅ доступ только для админов из .env (ADMIN_EMAILS)
  if (!isAdminEmail(session.user.email)) {
    notFound(); // "тихо" прячем админку
  }

  return (
    <div className="mx-auto max-w-[1440px] px-[16px] md:px-[40px] pt-[28px] pb-[90px]">
      {/* Top bar */}
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <div className="text-[18px] md:text-[22px] font-semibold tracking-[-0.02em]">
            Админ-панель
          </div>
          <div className="mt-1 text-[11px] text-black/45">
            Управление товарами, заказами и витриной
          </div>
        </div>

        <Link
          href="/"
          className={[
            "inline-flex items-center justify-center",
            "h-[38px] px-4",
            "border border-black/20 rounded-2xl",
            "text-[11px] uppercase tracking-[0.08em] font-semibold",
            "text-black/70 hover:text-black hover:border-black/35 hover:bg-black/[0.03] transition",
          ].join(" ")}
        >
          ← На сайт
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-[18px] h-fit">
          <div className="rounded-3xl border border-black/15 p-4">
            <div className="text-[11px] uppercase tracking-[0.1em] text-black/45">
              Разделы
            </div>

            <div className="mt-4 grid gap-2">
              {nav.map((i) => (
                <NavItem key={i.href} href={i.href} label={i.label} />
              ))}
            </div>

            <div className="mt-4 border-t border-black/10 pt-4">
              <div className="text-[10px] text-black/45 leading-[1.5]">
                Доступ: <span className="font-semibold text-black/70">admin</span>
                <div className="mt-1 break-all">{session.user.email}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}