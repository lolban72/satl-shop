import { prisma } from "@/lib/prisma";

function rub(cents: number) {
  const v = (cents ?? 0) / 100;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(v);
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-black/15 p-5">
      <div className="text-[14px] font-semibold tracking-[-0.01em]">
        {title}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-black/10 py-3 last:border-none">
      <div className="text-[12px] text-black/60">{label}</div>
      <div className="text-[14px] font-semibold">{value}</div>
    </div>
  );
}

export default async function AdminStatsPage() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // --------------------------
  // ДОСТАВЛЕННЫЕ ЗАКАЗЫ
  // --------------------------
  const deliveredOrders = await prisma.order.findMany({
    where: { status: "DELIVERED" },
    include: { items: true },
  });

  const revenueAll = deliveredOrders.reduce(
    (sum, order) => sum + order.total,
    0
  );

  const revenueToday = deliveredOrders
    .filter((o) => o.createdAt >= todayStart)
    .reduce((sum, o) => sum + o.total, 0);

  const revenue7 = deliveredOrders
    .filter((o) => o.createdAt >= d7)
    .reduce((sum, o) => sum + o.total, 0);

  const revenue30 = deliveredOrders
    .filter((o) => o.createdAt >= d30)
    .reduce((sum, o) => sum + o.total, 0);

  // --------------------------
  // ОТМЕНЁННЫЕ ЗАКАЗЫ
  // --------------------------
  const canceledOrders = await prisma.order.findMany({
    where: { status: "CANCELED" },
    include: { items: true },
  });

  const canceledRevenue = canceledOrders.reduce(
    (sum, order) => sum + order.total,
    0
  );

  const canceledCount = canceledOrders.length;

  // --------------------------
  // ТОП ПРОДАННЫХ ТОВАРОВ
  // --------------------------
  const deliveredItems = deliveredOrders.flatMap((o) => o.items);

  const topMap = new Map<
    string,
    { quantity: number; total: number }
  >();

  for (const item of deliveredItems) {
    const current = topMap.get(item.title) ?? {
      quantity: 0,
      total: 0,
    };

    current.quantity += item.quantity;
    current.total += item.price * item.quantity;

    topMap.set(item.title, current);
  }

  const top = Array.from(topMap.entries())
    .map(([title, data]) => ({
      title,
      quantity: data.quantity,
      total: data.total,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // --------------------------
  // ТОП ОТМЕНЁННЫХ ТОВАРОВ
  // --------------------------
  const canceledItems = canceledOrders.flatMap((o) => o.items);

  const canceledMap = new Map<
    string,
    { quantity: number; total: number }
  >();

  for (const item of canceledItems) {
    const current = canceledMap.get(item.title) ?? {
      quantity: 0,
      total: 0,
    };

    current.quantity += item.quantity;
    current.total += item.price * item.quantity;

    canceledMap.set(item.title, current);
  }

  const topCanceled = Array.from(canceledMap.entries())
    .map(([title, data]) => ({
      title,
      quantity: data.quantity,
      total: data.total,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[18px] md:text-[22px] font-semibold tracking-[-0.02em]">
          Статистика
        </div>
        <div className="mt-1 text-[12px] text-black/55">
          Выручка и показатели магазина
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block title="Выручка (завершённые)">
          <StatLine label="Общая" value={rub(revenueAll)} />
          <StatLine label="Сегодня" value={rub(revenueToday)} />
          <StatLine label="За 7 дней" value={rub(revenue7)} />
          <StatLine label="За 30 дней" value={rub(revenue30)} />
        </Block>

        <Block title="Отменённые заказы">
          <StatLine label="Количество" value={canceledCount} />
          <StatLine label="На сумму" value={rub(canceledRevenue)} />
        </Block>
      </div>

      {/* ТОП ПРОДАННЫЕ */}
      <Block title="Топ товаров (проданные)">
        <div className="overflow-x-auto rounded-2xl border border-black/15">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 bg-black/[0.02]">
              <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                <th>Товар</th>
                <th>Шт.</th>
                <th>На сумму</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {top.map((r) => (
                <tr key={r.title} className="[&>td]:px-4 [&>td]:py-3">
                  <td>{r.title}</td>
                  <td className="font-semibold">{r.quantity}</td>
                  <td className="font-semibold">{rub(r.total)}</td>
                </tr>
              ))}

              {top.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-black/50">
                    Данных пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Block>

      {/* ТОП ОТМЕНЁННЫЕ */}
      <Block title="Топ товаров (отменённые)">
        <div className="overflow-x-auto rounded-2xl border border-black/15">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 bg-black/[0.02]">
              <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                <th>Товар</th>
                <th>Шт.</th>
                <th>На сумму</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {topCanceled.map((r) => (
                <tr key={r.title} className="[&>td]:px-4 [&>td]:py-3">
                  <td>{r.title}</td>
                  <td className="font-semibold">{r.quantity}</td>
                  <td className="font-semibold">{rub(r.total)}</td>
                </tr>
              ))}

              {topCanceled.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-black/50">
                    Отменённых товаров нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Block>
    </div>
  );
}