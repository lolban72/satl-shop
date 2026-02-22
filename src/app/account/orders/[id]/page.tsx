import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AccountShell from "../../ui/AccountShell";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import OrderProgress from "@/components/OrderProgress";

function rub(cents: number) {
  return (cents / 100).toFixed(0) + "р";
}

export default async function OrderDetailsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/auth/login");

  const { id } = await props.params;

  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: { items: true },
  });

  if (!order) notFound();

  return (
    <AccountShell active="orders">
      <div className="max-w-[760px] mx-auto space-y-8">

        {/* HEADER */}
        <div className="border border-black/15 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[20px] font-semibold tracking-[-0.02em]">
                Заказ
              </div>
              <div className="text-[12px] text-black/45 mt-1 break-all">
                ID: {order.id}
              </div>
              <div className="text-[12px] text-black/45 mt-1">
                Создан: {new Date(order.createdAt).toLocaleString("ru-RU")}
              </div>
            </div>

            <OrderStatusBadge status={order.status as any} />
          </div>
        </div>

        {/* PROGRESS */}
        <div className="border border-black/15 p-6">
          <div className="text-[14px] font-semibold mb-3">
          </div>
          <OrderProgress status={order.status as any} />
        </div>

        {/* ITEMS */}
        <div className="border border-black/15 p-6">
          <div className="text-[14px] font-semibold mb-5">
            Состав заказа
          </div>

          <div className="space-y-4">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border-b border-black/10 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <div className="text-[14px] font-medium">
                    {item.title}
                  </div>
                  <div className="text-[12px] text-black/45 mt-1">
                    Количество: {item.quantity}
                  </div>
                </div>

                <div className="text-[14px] font-semibold">
                  {rub(item.price * item.quantity)}
                </div>
              </div>
            ))}
          </div>

          {/* TOTAL */}
          <div className="flex justify-between items-center mt-6 pt-5 border-t border-black/15">
            <div className="text-[15px] font-semibold">
              Итого
            </div>
            <div className="text-[18px] font-bold">
              {rub(order.total)}
            </div>
          </div>
        </div>

        {/* SUPPORT */}
        <div className="border border-black/15 p-6 text-[13px] text-black/60 leading-relaxed">
          Если у вас возникли вопросы по заказу, пожалуйста, свяжитесь с нашей
          службой поддержки. Укажите ID заказа для более быстрого решения
          вопроса.
        </div>

      </div>
    </AccountShell>
  );
}