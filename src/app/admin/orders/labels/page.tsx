import { prisma } from "@/lib/prisma";
import LabelsClient from "./labels-client";

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function getDayRangeUTC(dayRaw?: string) {
  const day = (dayRaw ?? "today").trim();

  const now = new Date();
  const todayUTC = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0
    )
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
  searchParams?: Promise<{ day?: string; ids?: string }>;
}) {
  const sp = (await props.searchParams) ?? {};

  const ids = String(sp.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let rawOrders: any[] = [];

  if (ids.length > 0) {
    rawOrders = await prisma.order.findMany({
      where: {
        id: { in: ids },
      },
      orderBy: { createdAt: "asc" },
      include: {
        items: true,
      },
      take: 2000,
    });
  } else {
    const { start, end } = getDayRangeUTC(sp.day);

    rawOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lt: end },
      },
      orderBy: { createdAt: "asc" },
      include: {
        items: true,
      },
      take: 2000,
    });
  }

  const variantIds = Array.from(
    new Set(
      rawOrders.flatMap((order) =>
        (order.items ?? [])
          .map((item: any) => item.variantId)
          .filter(Boolean)
      )
    )
  ) as string[];

  const variants =
    variantIds.length > 0
      ? await prisma.variant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, size: true, color: true },
        })
      : [];

  const vmap = new Map(variants.map((v) => [v.id, v]));

  const orders = rawOrders.map((order) => ({
    ...order,
    items: (order.items ?? []).map((item: any) => ({
      ...item,
      variant: item.variantId ? vmap.get(item.variantId) ?? null : null,
    })),
  }));

  return <LabelsClient orders={orders} />;
}