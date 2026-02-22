import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STATUS_META, STATUS_ORDER } from "@/lib/order-status";

function rub(cents: number) {
  const v = (cents ?? 0) / 100;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(v);
}

export default async function AdminOrdersPage(props: {
  searchParams?: Promise<{
    q?: string;
    status?: string;
  }>;
}) {
  const sp = (await props.searchParams) ?? {};
  const q = sp.q?.trim() ?? "";
  const status = sp.status?.toUpperCase();

  const where: any = {};

  if (q) {
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  if (status && STATUS_ORDER.includes(status as any)) {
    where.status = status;
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      items: { select: { id: true } },
      user: { select: { email: true } },
    },
    take: 200,
  });

  return (
    <div className="min-w-0">
      <div className="mb-4">
        <div className="text-xl font-semibold">Заказы</div>
        <div className="text-sm text-black/55">Поиск и фильтрация</div>
      </div>

      {/* Поиск + фильтр */}
      <form className="mb-6 flex flex-wrap gap-3">
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
              const meta =
                STATUS_META[o.status as any] ??
                { label: o.status, badgeClass: "border-black/15 bg-gray-50 text-black/70" };

              return (
                <tr key={o.id} className="[&>td]:px-4 [&>td]:py-3">
                  <td>{new Date(o.createdAt).toLocaleString("ru-RU")}</td>
                  <td className="font-mono text-[12px]">{o.id.slice(0, 10)}…</td>
                  <td>
                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-2 py-1 text-[12px] font-semibold",
                        meta.badgeClass,
                      ].join(" ")}
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td className="font-semibold">{rub(o.total)}</td>
                  <td>{o.items.length}</td>
                  <td>
                    {o.user?.email ?? "—"}
                    <div className="text-[12px] text-black/50">{o.name}</div>
                  </td>
                  <td>
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
          </tbody>
        </table>
      </div>
    </div>
  );
}