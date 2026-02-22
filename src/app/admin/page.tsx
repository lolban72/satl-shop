import Link from "next/link";
import { prisma } from "@/lib/prisma";

function StatPill({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-black/15 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.1em] text-black/45">
        {label}
      </div>
      <div className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-black">
        {value}
      </div>
    </div>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center justify-between",
        "h-[40px] w-full px-4",
        "rounded-2xl border border-black/15",
        "text-[11px] uppercase tracking-[0.08em] font-semibold",
        "text-black/70 hover:text-black hover:border-black/30 hover:bg-black/[0.03] transition",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className="text-black/30">→</span>
    </Link>
  );
}

function Card({
  title,
  desc,
  links,
}: {
  title: string;
  desc: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="rounded-3xl border border-black/15 p-5">
      <div className="text-[14px] font-semibold tracking-[-0.01em] text-black">
        {title}
      </div>
      <div className="mt-2 text-[12px] leading-[1.5] text-black/55">
        {desc}
      </div>

      <div className="mt-5 grid gap-2">
        {links.map((l) => (
          <ActionLink key={l.href} href={l.href} label={l.label} />
        ))}
      </div>
    </div>
  );
}

export default async function AdminDashboard() {
  const [productsCount, categoriesCount, ordersCount] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.order.count(),
  ]);


  const cards = [
    {
      title: "Заказы",
      desc: "Просмотр заказов, статусы, печать этикеток.",
      links: [{ href: "/admin/orders", label: "Открыть заказы" }],
    },
    {
      title: "Статистика",
      desc: "Выручка, динамика по дням, топ-товары.",
      links: [{ href: "/admin/stats", label: "Открыть статистику" }],
    },
    {
      title: "Товары",
      desc: "Добавление, редактирование и удаление товаров.",
      links: [
        { href: "/admin/products", label: "Список товаров" },
        { href: "/admin/products/new", label: "Добавить товар" },
        { href: "/admin/products/size-chart", label: "Таблицы размеров" },
      ],
    },
    {
      title: "Категории",
      desc: "Создание и управление категориями.",
      links: [{ href: "/admin/categories", label: "Управление категориями" }],
    },
    {
      title: "Навигация",
      desc: "Порядок категорий отдельно для шапки и главной.",
      links: [
        { href: "/admin/navigation/header", label: "Порядок в шапке" },
        { href: "/admin/navigation/home", label: "Порядок на главной" },
      ],
    },
    {
      title: "Маркетинг",
      desc: "Hero-баннер на главной (текст, кнопка, фон, включение).",
      links: [{ href: "/admin/marketing/hero", label: "Hero баннер" }],
    },
    {
      title: "Бегущая строка",
      desc: "Текст, скорость и включение бегущей строки в шапке.",
      links: [{ href: "/admin/marquee", label: "Управление строкой" }],
    },
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-black/15 p-5">
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="text-[16px] font-semibold tracking-[-0.01em]">
              Сводка
            </div>
            <div className="mt-1 text-[12px] text-black/55">
              Коротко по основным сущностям проекта
            </div>
          </div>

          <div className="hidden md:block text-[11px] text-black/45">
            Обновляется автоматически
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatPill label="Товары" value={productsCount} />
          <StatPill label="Категории" value={categoriesCount} />
          <StatPill label="Заказы" value={ordersCount} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {cards.map((c) => (
          <Card key={c.title} title={c.title} desc={c.desc} links={c.links} />
        ))}
      </div>
    </div>
  );
}