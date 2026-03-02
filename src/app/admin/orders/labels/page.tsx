import { prisma } from "@/lib/prisma";
import LabelsClient from "./labels-client";

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

const MSK_OFFSET_MIN = 180; // UTC+3

function getDayRangeMSK(dayRaw?: string) {
  const day = (dayRaw ?? "today").trim();

  // текущее время в МСК (через сдвиг от UTC)
  const nowUtcMs = Date.now();
  const nowMskMs = nowUtcMs + MSK_OFFSET_MIN * 60_000;

  const nowMsk = new Date(nowMskMs);
  let y = nowMsk.getUTCFullYear();
  let m = nowMsk.getUTCMonth();
  let d = nowMsk.getUTCDate();

  if (day === "yesterday") {
    const yestMsk = new Date(nowMskMs - 24 * 60 * 60 * 1000);
    y = yestMsk.getUTCFullYear();
    m = yestMsk.getUTCMonth();
    d = yestMsk.getUTCDate();
  } else if (isIsoDate(day)) {
    const parts = day.split("-").map(Number);
    y = parts[0];
    m = parts[1] - 1;
    d = parts[2];
  }

  // 00:00 МСК этого дня в UTC
  const startUtcMs =
    Date.UTC(y, m, d, 0, 0, 0, 0) - MSK_OFFSET_MIN * 60_000;

  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;

  return {
    start: new Date(startUtcMs),
    end: new Date(endUtcMs),
    day,
  };
}

export default async function LabelsPage(props: {
  searchParams?: Promise<{ day?: string }>;
}) {
  const sp = (await props.searchParams) ?? {};
  const { start, end } = getDayRangeMSK(sp.day);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        include: {
          variant: true,
        },
      },
    },
    take: 2000,
  });

  return <LabelsClient orders={orders} />;
}