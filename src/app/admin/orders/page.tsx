import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { STATUS_META, STATUS_ORDER, type OrderStatus } from "@/lib/order-status";

export const metadata = {
  title: "Заказы | SATL-админ",
};

function rub(cents: number) {
  const v = (cents ?? 0) / 100;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(v);
}

function isOrderStatus(v?: string): v is OrderStatus {
  if (!v) return false;
  return (STATUS_ORDER as readonly string[]).includes(v);
}

export default async function AdminOrdersPage(props: {
  searchParams?: Promise<{
    q?: string;
    status?: string;
  }>;
}) {
  const sp = (await props.searchParams) ?? {};

  const q = (sp.q ?? "").trim();
  const statusRaw = (sp.status ?? "").trim().toUpperCase();

  const where: any = {};

  if (q) {
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  const status = isOrderStatus(statusRaw) ? (statusRaw as OrderStatus) : undefined;
  if (status) where.status = status;

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      items: { select: { id: true } },
      user: { select: { email: true } },
    },
    take: 500,
  });

  const ordersCount = orders.length;

  async function printLabelsAction() {
    "use server";

    const newOrders = await prisma.order.findMany({
      where: {
        status: "NEW",
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: 500,
    });

    const ids = newOrders.map((o) => o.id);

    if (ids.length === 0) {
      redirect("/admin/orders");
    }

    await prisma.order.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        status: "PROCESSING",
      },
    });

    redirect(`/admin/orders/labels?ids=${encodeURIComponent(ids.join(","))}`);
  }

  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-xl font-semibold">Заказы</div>
          <div className="text-sm text-black/55">Показаны все заказы с учетом фильтров</div>
        </div>

        <form action={printLabelsAction} className="flex items-center gap-2">
          <button className="h-9 rounded-xl bg-black px-4 text-sm font-semibold text-white">
            Печать этикеток
          </button>
        </form>
      </div>

      <form className="mb-6 flex flex-wrap items-center gap-3" method="GET">
        <input
          name="q"
          defaultValue={q}
          placeholder="Поиск по ID, имени, телефону"
          className="h-9 rounded-xl border px-3 text-sm"
        />

        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-9 rounded-xl border px-3 text-sm"
        >
          <option value="">Все статусы</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>

        <button className="h-9 rounded-xl bg-black px-4 text-sm font-semibold text-white">
          Найти
        </button>

        <div className="text-sm text-black/60">Заказов: {ordersCount}</div>
      </form>

      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
              <th>Дата</th>
              <th>ID</th>
              <th>Статус</th>
              <th>Сумма</th>
              <th>Товаров</th>
              <th>Покупатель</th>
              <th></th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {orders.map((o) => {
              const os = o.status as OrderStatus;
              const meta = STATUS_META[os] ?? {
                label: String(o.status),
                badgeClass: "border-black/15 bg-gray-50 text-black/70",
              };

              return (
                <tr key={o.id} className="[&>td]:px-4 [&>td]:py-3">
                  <td className="whitespace-nowrap text-black/70">
                    {new Date(o.createdAt).toLocaleString("ru-RU")}
                  </td>

                  <td className="font-mono text-[12px] text-black/70">{o.id.slice(0, 10)}…</td>

                  <td>
                    <span className={meta.badgeClass}>{meta.label}</span>
                  </td>

                  <td className="font-semibold">{rub(o.total)}</td>

                  <td className="text-black/70">{o.items.length}</td>

                  <td className="text-black/70">
                    {o.user?.email ?? "—"}
                    <div className="text-[12px] text-black/50">{o.name}</div>
                  </td>

                  <td className="whitespace-nowrap">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="rounded-xl border px-3 py-2 text-[12px] hover:bg-gray-50"
                    >
                      Открыть →
                    </Link>
                  </td>
                </tr>
              );
            })}

            {orders.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-black/50" colSpan={7}>
                  Ничего не найдено
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}