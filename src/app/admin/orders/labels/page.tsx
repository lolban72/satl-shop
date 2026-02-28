import { prisma } from "@/lib/prisma";
import LabelsClient from "./labels-client";

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function getDayRangeUTC(dayRaw?: string) {
  const day = (dayRaw ?? "today").trim();

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
  const { start, end, day } = getDayRangeUTC(sp.day);

  // ✅ важно: чтобы size работал, нужно включить variant у item
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        include: {
          variant: true, // ✅ чтобы firstItem.variant.size существовал
        },
      },
    },
    take: 2000,
  });

  return <LabelsClient orders={orders} />;
}