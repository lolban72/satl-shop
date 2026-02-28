import { prisma } from "@/lib/prisma";
import PrintOnLoad from "./print-on-load";

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function getDayRangeUTC(dayRaw?: string) {
  const day = (dayRaw ?? "today").trim(); // ✅ FIX: всегда string

  const now = new Date();
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );

  let start = todayUTC;

  if (day === "yesterday") {
    start = new Date(todayUTC.getTime() - 24 * 60 * 60 * 1000);
  } else if (isIsoDate(day)) {
    const [y, m, d] = day.split("-").map(Number);
    start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  }

  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, day };
}

export default async function LabelsPage(props: {
  searchParams?: Promise<{ day?: string }>;
}) {
  const sp = (await props.searchParams) ?? {};

  // ✅ FIX: берём нормализованный day из getDayRangeUTC
  const { start, end, day } = getDayRangeUTC(sp.day);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "asc" },
    include: {
      items: true,
      user: true,
    },
    take: 2000,
  });

  return (
    <div className="p-6">
      <PrintOnLoad />

      <div className="mb-4 text-sm text-black/60">
        Этикетки за: <span className="font-semibold">{day}</span> • Заказов:{" "}
        <span className="font-semibold">{orders.length}</span>
      </div>

      <div className="grid gap-4">
        {orders.map((o) => (
          <div
            key={o.id}
            className="rounded-xl border p-4"
            style={{ pageBreakInside: "avoid" }}
          >
            <div className="text-[12px] text-black/60">Заказ</div>
            <div className="font-mono text-[14px] font-semibold">{o.id}</div>

            <div className="mt-2 text-[12px] text-black/60">Получатель</div>
            <div className="text-[14px] font-semibold">{o.name}</div>
            <div className="text-[13px]">{o.phone}</div>

            <div className="mt-2 text-[12px] text-black/60">Адрес</div>
            <div className="text-[13px]">{o.address}</div>
          </div>
        ))}

        {orders.length === 0 ? (
          <div className="text-black/60">Заказов за этот день нет.</div>
        ) : null}
      </div>
    </div>
  );
}