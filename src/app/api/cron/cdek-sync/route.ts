// src/app/api/cron/cdek-sync/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tgSendMessage } from "@/lib/tg";

export const runtime = "nodejs";

const ENV = String(process.env.CDEK_ENV ?? "TEST").toUpperCase();
const BASE_URL =
  ENV === "PROD"
    ? "https://api.cdek.ru/v2"
    : "https://api.edu.cdek.ru/v2";

function statusLabel(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "SHIPPED") return "В доставке 🚚";
  if (s === "DELIVERED") return "Доставлен ✅";
  return s;
}

async function notifyUserOrderStatus(params: {
  userId: string | null;
  orderId: string;
  status: string;
  trackNumber?: string | null;
}) {
  if (!params.userId) return;

  const u = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { tgChatId: true },
  });
  if (!u?.tgChatId) return;

  const status = String(params.status || "").toUpperCase();
  const track = params.trackNumber
    ? `\nТрек номер: <code>${params.trackNumber}</code>`
    : "";

  let text = "";

  if (status === "SHIPPED") {
    text =
      `<b>Ваш заказ передан в доставку 🚚</b>\n` +
      `Заказ: <code>${params.orderId}</code>` +
      `${track}\n\n` +
      `Вы можете отслеживать его в личном кабинете:\n` +
      `<a href="https://satl.shop/account/orders" target="_blank">Мои заказы</a>`;
  } else if (status === "DELIVERED") {
    text =
      `<b>Ваш заказ доставлен ✅</b>\n` +
      `Заказ: <code>${params.orderId}</code>` +
      `${track}\n\n` +
      `Спасибо за покупку 💛`;
  } else {
    text =
      `<b>Статус заказа изменён</b>\n` +
      `Заказ: <code>${params.orderId}</code>\n` +
      `Статус: <b>${statusLabel(status)}</b>` +
      `${track}\n\n` +
      `Ссылка: <a href="https://satl.shop/account/orders" target="_blank">Мои заказы</a>`;
  }

  await tgSendMessage(u.tgChatId, text).catch(() => {});
}

function mapCdekStatusToOrderStatus(rawStatus: string) {
  const s = String(rawStatus ?? "").toUpperCase();

  if (
    s.includes("DELIVERED") ||
    s.includes("ВРУЧЕН") ||
    s.includes("ВЫДАН")
  ) {
    return "DELIVERED";
  }

  // Пока в Prisma enum нет READY_FOR_PICKUP,
  // статусы готовности к выдаче считаем как SHIPPED
  if (
    s.includes("READY_FOR_PICKUP") ||
    s.includes("READY TO BE ISSUED") ||
    s.includes("ГОТОВ К ВЫДАЧЕ") ||
    s.includes("ПРИБЫЛ В ПУНКТ ВЫДАЧИ") ||
    s.includes("ПОСТУПИЛ В ПУНКТ ВЫДАЧИ")
  ) {
    return "SHIPPED";
  }

  if (
    s.includes("IN_TRANSIT") ||
    s.includes("TRANSIT") ||
    s.includes("ОТПРАВЛЕН") ||
    s.includes("В ПУТИ") ||
    s.includes("ПРИНЯТ") ||
    s.includes("ACCEPTED") ||
    s.includes("RECEIVED_AT_SHIPMENT_WAREHOUSE")
  ) {
    return "SHIPPED";
  }

  return null;
}

function getEntity(raw: any) {
  if (
    raw?.entity &&
    typeof raw.entity === "object" &&
    !Array.isArray(raw.entity)
  ) {
    return raw.entity;
  }

  if (Array.isArray(raw?.entity) && raw.entity.length > 0) {
    return raw.entity[0];
  }

  if (Array.isArray(raw?.entities) && raw.entities.length > 0) {
    return raw.entities[0];
  }

  return null;
}

function extractTrackNumber(raw: any): string | null {
  const entity = getEntity(raw);
  return String(entity?.cdek_number ?? entity?.number ?? "").trim() || null;
}

function extractStatus(raw: any): string | null {
  const entity = getEntity(raw);
  return (
    String(entity?.statuses?.[0]?.code ?? entity?.status?.code ?? "").trim() ||
    null
  );
}

function extractStatusName(raw: any): string | null {
  const entity = getEntity(raw);
  return (
    String(entity?.statuses?.[0]?.name ?? entity?.status?.name ?? "").trim() ||
    null
  );
}

async function getCdekAccessToken() {
  const clientId = process.env.CDEK_CLIENT_ID;
  const clientSecret = process.env.CDEK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("CDEK_CLIENT_ID/CDEK_CLIENT_SECRET не заданы");
  }

  const form = new URLSearchParams();
  form.set("grant_type", "client_credentials");
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    cache: "no-store",
  });

  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(
      `CDEK auth failed: ${res.status} ${JSON.stringify(data)}`
    );
  }

  const accessToken = String(data?.access_token ?? "").trim();
  if (!accessToken) {
    throw new Error(`CDEK auth: access_token not returned: ${text}`);
  }

  return accessToken;
}

async function fetchCdekOrderByUuid(uuid: string) {
  const token = await getCdekAccessToken();

  const res = await fetch(`${BASE_URL}/orders/${encodeURIComponent(uuid)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(
      `CDEK get order failed: ${res.status} ${JSON.stringify(data)}`
    );
  }

  return data;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";
    const expected = process.env.CRON_SECRET || "";

    if (!expected || token !== expected) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const orders = await prisma.order.findMany({
      where: {
        cdekUuid: { not: null },
        OR: [{ trackNumber: null }, { status: "NEW" }, { status: "SHIPPED" }],
      },
      select: {
        id: true,
        userId: true,
        cdekUuid: true,
        trackNumber: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const results: any[] = [];

    for (const order of orders) {
      try {
        if (!order.cdekUuid) continue;

        const raw = await fetchCdekOrderByUuid(order.cdekUuid);

        const cdekNumber = extractTrackNumber(raw);
        const statusCode = extractStatus(raw);
        const statusName = extractStatusName(raw);
        const mappedStatus = mapCdekStatusToOrderStatus(
          statusCode || statusName || ""
        );

        const prevStatus = String(order.status).toUpperCase();
        const updateData: Record<string, any> = {};

        if (cdekNumber && cdekNumber !== order.trackNumber) {
          updateData.trackNumber = cdekNumber;
        }

        if (mappedStatus && mappedStatus !== prevStatus) {
          updateData.status = mappedStatus;
        }

        let updatedOrder:
          | {
              id: string;
              userId: string | null;
              status: string;
              trackNumber: string | null;
            }
          | null = null;

        if (Object.keys(updateData).length > 0) {
          updatedOrder = await prisma.order.update({
            where: { id: order.id },
            data: updateData,
            select: {
              id: true,
              userId: true,
              status: true,
              trackNumber: true,
            },
          });
        }

        const newStatus = String(
          updatedOrder?.status ?? order.status ?? ""
        ).toUpperCase();

        if (
          updatedOrder &&
          prevStatus !== newStatus &&
          (newStatus === "SHIPPED" || newStatus === "DELIVERED")
        ) {
          await notifyUserOrderStatus({
            userId: updatedOrder.userId,
            orderId: updatedOrder.id,
            status: updatedOrder.status,
            trackNumber: updatedOrder.trackNumber,
          });
        }

        results.push({
          orderId: order.id,
          ok: true,
          cdekUuid: order.cdekUuid,
          cdekNumber: cdekNumber || null,
          statusCode: statusCode || null,
          statusName: statusName || null,
          updated: Object.keys(updateData).length > 0,
          updateData,
        });
      } catch (e: any) {
        results.push({
          orderId: order.id,
          ok: false,
          error: e?.message || "sync failed",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      count: results.length,
      results,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "cron cdek sync error" },
      { status: 500 }
    );
  }
}