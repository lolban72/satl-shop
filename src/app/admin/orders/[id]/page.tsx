import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OrderStatusForm from "../OrderStatusForm";

function rub(cents: number) {
  const v = (cents ?? 0) / 100;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(v);
}

export default async function AdminOrderPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { email: true } },
      items: true,
    },
  });

  if (!order) notFound();

  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-xl font-semibold">Заказ</div>
          <div className="text-sm text-black/55 font-mono">{order.id}</div>
        </div>
        <Link
          href="/admin/orders"
          className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
        >
          ← Назад
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ЛЕВАЯ ЧАСТЬ */}
        <div className="rounded-2xl border p-4">
          <div className="text-sm font-semibold">Состав заказа</div>

          <div className="mt-3 overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-semibold">
                  <th>Товар</th>
                  <th>Цена</th>
                  <th>Кол</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.items.map((it) => (
                  <tr key={it.id} className="[&>td]:px-3 [&>td]:py-2">
                    <td>
                      <div className="font-semibold">{it.title}</div>
                      <div className="text-[12px] text-black/50">
                        productId: {it.productId}
                        {it.variantId ? ` · variantId: ${it.variantId}` : ""}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{rub(it.price)}</td>
                    <td>{it.quantity}</td>
                    <td className="whitespace-nowrap font-semibold">
                      {rub(it.price * it.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-black/60">
              Создан: {new Date(order.createdAt).toLocaleString("ru-RU")}
            </div>
            <div className="text-lg font-semibold">{rub(order.total)}</div>
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА */}
        <div className="grid gap-6">
          <OrderStatusForm orderId={order.id} initialStatus={order.status} />

          {/* Блок печати */}
          <div className="rounded-2xl border p-4">
            <div className="text-sm font-semibold">Этикетка</div>

            <div className="mt-3 text-[12px] text-black/60">
              Печать наклейки для отправки
            </div>

            <Link
              href={`/admin/orders/${order.id}/label`}
              target="_blank"
              className="mt-3 inline-block w-full text-center rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85 transition"
            >
              Печать этикетки
            </Link>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-sm font-semibold">Покупатель</div>
            <div className="mt-2 text-sm text-black/70">
              <div>
                <span className="text-black/50">Email:</span>{" "}
                {order.user?.email ?? "—"}
              </div>
              <div>
                <span className="text-black/50">Имя:</span> {order.name}
              </div>
              <div>
                <span className="text-black/50">Телефон:</span> {order.phone}
              </div>
              <div className="mt-2">
                <span className="text-black/50">Адрес:</span> {order.address}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}