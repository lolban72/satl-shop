"use client";

import { useMemo, useState } from "react";

function rub(cents: number) {
  const v = (cents ?? 0) / 100;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(v);
}

function dt(v: string) {
  const d = new Date(v);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function clsx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function Block({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-black/15 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-[14px] font-semibold tracking-[-0.01em]">{title}</div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-black/10 py-3 last:border-none gap-4">
      <div className="text-[12px] text-black/60">{label}</div>
      <div className="text-[14px] font-semibold text-right">{value}</div>
    </div>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "green" | "gray";
}) {
  const cls =
    tone === "green"
      ? "bg-green-100 text-green-800 border-green-200"
      : tone === "gray"
      ? "bg-black/[0.04] text-black/60 border-black/10"
      : "bg-white text-black border-black/15";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function MiniCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border border-black/15 bg-white p-5">
      <div className="text-[11px] uppercase tracking-[0.08em] text-black/45">{label}</div>
      <div className="mt-2 text-[28px] font-semibold tracking-[-0.03em]">{value}</div>
      {hint ? <div className="mt-1 text-[12px] text-black/50">{hint}</div> : null}
    </div>
  );
}

function KpiTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-black/[0.015] p-4">
      <div className="text-[11px] uppercase tracking-[0.08em] text-black/45">{label}</div>
      <div className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">{value}</div>
      {hint ? <div className="mt-1 text-[12px] text-black/50">{hint}</div> : null}
    </div>
  );
}

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  isVerified: boolean;
  hasTelegram: boolean;
  createdAt: string;
  ordersCount: number;
  deliveredCount: number;
  ordersTotalSum: number;
};

type ProductRow = {
  title: string;
  quantity: number;
  total: number;
};

export default function AdminStatsClient({
  summary,
  users,
  top,
  topCanceled,
}: {
  summary: {
    usersTotal: number;
    verifiedUsers: number;
    telegramUsers: number;
    users7: number;
    users30: number;
    ordersTotal: number;
    ordersNew: number;
    ordersProcessing: number;
    ordersShipped: number;
    ordersDelivered: number;
    ordersCanceled: number;
    ordersReturned: number;
    productsTotal: number;
    productsOutOfStock: number;
    productsWithDiscount: number;
    categoriesTotal: number;
    revenueAll: number;
    revenueToday: number;
    revenue7: number;
    revenue30: number;
    avgCheck: number;
    canceledRevenue: number;
    canceledCount: number;
  };
  users: UserRow[];
  top: ProductRow[];
  topCanceled: ProductRow[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    "all" | "verified" | "unverified" | "telegram" | "no-telegram"
  >("all");
  const [sortBy, setSortBy] = useState<"newest" | "orders" | "revenue">("newest");

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();

    let rows = users.filter((u) => {
      const matchesQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q);

      const matchesFilter =
        filter === "all"
          ? true
          : filter === "verified"
          ? u.isVerified
          : filter === "unverified"
          ? !u.isVerified
          : filter === "telegram"
          ? u.hasTelegram
          : !u.hasTelegram;

      return matchesQuery && matchesFilter;
    });

    rows = [...rows].sort((a, b) => {
      if (sortBy === "orders") return b.ordersCount - a.ordersCount;
      if (sortBy === "revenue") return b.ordersTotalSum - a.ordersTotalSum;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return rows;
  }, [users, query, filter, sortBy]);

  const latestUsers = useMemo(() => users.slice(0, 12), [users]);

  const latest7 = useMemo(() => {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return users.filter((u) => new Date(u.createdAt).getTime() >= since);
  }, [users]);

  const latest30 = useMemo(() => {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return users.filter((u) => new Date(u.createdAt).getTime() >= since);
  }, [users]);

  const verifiedPercent =
    summary.usersTotal > 0
      ? `${Math.round((summary.verifiedUsers / summary.usersTotal) * 100)}%`
      : "0%";

  const telegramPercent =
    summary.usersTotal > 0
      ? `${Math.round((summary.telegramUsers / summary.usersTotal) * 100)}%`
      : "0%";

  const avgOrdersPerUser =
    summary.usersTotal > 0 ? (summary.ordersTotal / summary.usersTotal).toFixed(2) : "0";

  const latest7Verified = latest7.filter((u) => u.isVerified).length;
  const latest7Telegram = latest7.filter((u) => u.hasTelegram).length;
  const latest30Verified = latest30.filter((u) => u.isVerified).length;
  const latest30Telegram = latest30.filter((u) => u.hasTelegram).length;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[18px] md:text-[22px] font-semibold tracking-[-0.02em]">
          Статистика
        </div>
        <div className="mt-1 text-[12px] text-black/55">
          Пользователи, заказы, выручка и показатели магазина
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniCard label="Пользователи" value={summary.usersTotal} hint={`Верифицировано: ${summary.verifiedUsers}`} />
        <MiniCard label="Заказы" value={summary.ordersTotal} hint={`Новых: ${summary.ordersNew}`} />
        <MiniCard label="Выручка" value={rub(summary.revenueAll)} hint={`За 30 дней: ${rub(summary.revenue30)}`} />
        <MiniCard label="Средний чек" value={rub(summary.avgCheck)} hint={`Доставленных: ${summary.ordersDelivered}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-4">
        <Block title="Пользователи">
          <StatLine label="Всего" value={summary.usersTotal} />
          <StatLine label="Верифицированные" value={summary.verifiedUsers} />
          <StatLine label="С Telegram" value={summary.telegramUsers} />
          <StatLine label="За 7 дней" value={summary.users7} />
          <StatLine label="За 30 дней" value={summary.users30} />
        </Block>

        <Block title="Заказы">
          <StatLine label="Всего" value={summary.ordersTotal} />
          <StatLine label="Новые" value={summary.ordersNew} />
          <StatLine label="В обработке" value={summary.ordersProcessing} />
          <StatLine label="Отправленные" value={summary.ordersShipped} />
          <StatLine label="Доставленные" value={summary.ordersDelivered} />
          <StatLine label="Отменённые" value={summary.ordersCanceled} />
          <StatLine label="Возвраты" value={summary.ordersReturned} />
        </Block>

        <Block title="Выручка">
          <StatLine label="Общая" value={rub(summary.revenueAll)} />
          <StatLine label="Сегодня" value={rub(summary.revenueToday)} />
          <StatLine label="За 7 дней" value={rub(summary.revenue7)} />
          <StatLine label="За 30 дней" value={rub(summary.revenue30)} />
          <StatLine label="Средний чек" value={rub(summary.avgCheck)} />
        </Block>

        <Block title="Каталог">
          <StatLine label="Товаров" value={summary.productsTotal} />
          <StatLine label="Категорий" value={summary.categoriesTotal} />
          <StatLine label="Со скидкой" value={summary.productsWithDiscount} />
          <StatLine label="Без остатка" value={summary.productsOutOfStock} />
          <StatLine label="Отменённых заказов" value={summary.canceledCount} />
          <StatLine label="Отменено на сумму" value={rub(summary.canceledRevenue)} />
        </Block>
      </div>

      <Block title="Последние зарегистрированные пользователи">
        <div className="grid gap-4 xl:grid-cols-4">
          <KpiTile
            label="Новые за 7 дней"
            value={summary.users7}
            hint={`Верифицировано: ${latest7Verified}, Telegram: ${latest7Telegram}`}
          />
          <KpiTile
            label="Новые за 30 дней"
            value={summary.users30}
            hint={`Верифицировано: ${latest30Verified}, Telegram: ${latest30Telegram}`}
          />
          <KpiTile
            label="Доля верификации среди новых"
            value={
              summary.users30 > 0
                ? `${Math.round((latest30Verified / summary.users30) * 100)}%`
                : "0%"
            }
            hint="За последние 30 дней"
          />
          <KpiTile
            label="Доля Telegram среди новых"
            value={
              summary.users30 > 0
                ? `${Math.round((latest30Telegram / summary.users30) * 100)}%`
                : "0%"
            }
            hint="За последние 30 дней"
          />
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-black/15">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 bg-black/[0.02]">
              <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                <th>Пользователь</th>
                <th>Email</th>
                <th>Телефон</th>
                <th>Статус</th>
                <th>Telegram</th>
                <th>Регистрация</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {latestUsers.map((u) => (
                <tr key={u.id} className="[&>td]:px-4 [&>td]:py-3 align-top">
                  <td className="font-medium whitespace-nowrap">{u.name}</td>
                  <td>{u.email}</td>
                  <td className="whitespace-nowrap">{u.phone}</td>
                  <td>
                    {u.isVerified ? (
                      <Badge tone="green">Верифицирован</Badge>
                    ) : (
                      <Badge tone="gray">Не верифицирован</Badge>
                    )}
                  </td>
                  <td>
                    {u.hasTelegram ? (
                      <Badge tone="green">Привязан</Badge>
                    ) : (
                      <Badge tone="gray">Нет</Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap">{dt(u.createdAt)}</td>
                </tr>
              ))}

              {latestUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-black/50">
                    Пользователей пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Block>

      <Block title="Сводка по клиентской базе">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiTile
            label="Не верифицированные"
            value={summary.usersTotal - summary.verifiedUsers}
            hint={`Доля: ${
              summary.usersTotal > 0
                ? `${Math.round(((summary.usersTotal - summary.verifiedUsers) / summary.usersTotal) * 100)}%`
                : "0%"
            }`}
          />
          <KpiTile
            label="Без Telegram"
            value={summary.usersTotal - summary.telegramUsers}
            hint={`Доля: ${
              summary.usersTotal > 0
                ? `${Math.round(((summary.usersTotal - summary.telegramUsers) / summary.usersTotal) * 100)}%`
                : "0%"
            }`}
          />
          <KpiTile
            label="Конверсия в верификацию"
            value={verifiedPercent}
            hint={`${summary.verifiedUsers} из ${summary.usersTotal}`}
          />
          <KpiTile
            label="Конверсия в Telegram"
            value={telegramPercent}
            hint={`${summary.telegramUsers} из ${summary.usersTotal}`}
          />
          <KpiTile
            label="Среднее заказов на пользователя"
            value={avgOrdersPerUser}
            hint={`Всего заказов: ${summary.ordersTotal}`}
          />
        </div>
      </Block>

      <Block
        title="Пользователи сайта"
        actions={
          <div className="text-[12px] text-black/50">
            Найдено: <span className="font-semibold text-black">{filteredUsers.length}</span>
          </div>
        }
      >
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени, email или телефону"
            className="h-[42px] rounded-2xl border border-black/15 px-4 text-[14px] outline-none focus:border-black/35"
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="h-[42px] rounded-2xl border border-black/15 px-4 text-[14px] outline-none focus:border-black/35 bg-white"
          >
            <option value="all">Все пользователи</option>
            <option value="verified">Только верифицированные</option>
            <option value="unverified">Только не верифицированные</option>
            <option value="telegram">Только с Telegram</option>
            <option value="no-telegram">Только без Telegram</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-[42px] rounded-2xl border border-black/15 px-4 text-[14px] outline-none focus:border-black/35 bg-white"
          >
            <option value="newest">Сначала новые</option>
            <option value="orders">По количеству заказов</option>
            <option value="revenue">По сумме заказов</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-black/15">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 bg-black/[0.02]">
              <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                <th>Имя</th>
                <th>Email</th>
                <th>Телефон</th>
                <th>Статус</th>
                <th>Telegram</th>
                <th>Заказов</th>
                <th>Доставлено</th>
                <th>Сумма заказов</th>
                <th>Регистрация</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="[&>td]:px-4 [&>td]:py-3 align-top">
                  <td className="font-medium whitespace-nowrap">{u.name}</td>
                  <td>{u.email}</td>
                  <td className="whitespace-nowrap">{u.phone}</td>
                  <td>
                    {u.isVerified ? (
                      <Badge tone="green">Верифицирован</Badge>
                    ) : (
                      <Badge tone="gray">Не верифицирован</Badge>
                    )}
                  </td>
                  <td>
                    {u.hasTelegram ? (
                      <Badge tone="green">Привязан</Badge>
                    ) : (
                      <Badge tone="gray">Нет</Badge>
                    )}
                  </td>
                  <td className="font-semibold">{u.ordersCount}</td>
                  <td className="font-semibold">{u.deliveredCount}</td>
                  <td className="font-semibold whitespace-nowrap">{rub(u.ordersTotalSum)}</td>
                  <td className="whitespace-nowrap">{dt(u.createdAt)}</td>
                </tr>
              ))}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-black/50">
                    По вашему запросу ничего не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Block>

      <div className="grid gap-6 xl:grid-cols-2">
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
    </div>
  );
}