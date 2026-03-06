import { prisma } from "@/lib/prisma";
import { tgSendMessage, parseChatIds } from "@/lib/tg";
import { getCdekClient } from "@/lib/cdek-client";

function b64urlDecodeToString(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  return Buffer.from(s, "base64").toString("utf8");
}

function rubFromCents(cents: number) {
  return `${((cents ?? 0) / 100).toFixed(0)}р`;
}

function statusLabel(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "SHIPPED") return "В доставке 🚚";
  if (s === "DELIVERED") return "Доставлен ✅";
  return s;
}

function normalizePhone(phone: string) {
  const raw = String(phone ?? "").trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  return `+${digits}`;
}

function safeNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function extractCdekError(err: any) {
  return {
    message: err?.message || "CDEK request failed",
    response: err?.response ?? null,
    data: err?.data ?? null,
    body: err?.body ?? null,
    errors: err?.errors ?? null,
    cause: err?.cause ?? null,
  };
}

async function registerCdekOrder(params: {
  orderId: string;
  recipientName: string;
  recipientPhone: string;
  pvzCode: string;
}) {
  const fromCity = String(process.env.CDEK_FROM_CITY ?? "").trim();
  if (!fromCity) {
    throw new Error("CDEK_FROM_CITY env required");
  }

  const tariffCode = safeNumber(process.env.CDEK_DEFAULT_TARIFF_CODE, 11);
  const weight = safeNumber(process.env.CDEK_DEFAULT_WEIGHT_GR, 400);
  const length = safeNumber(process.env.CDEK_DEFAULT_LENGTH_CM, 20);
  const width = safeNumber(process.env.CDEK_DEFAULT_WIDTH_CM, 15);
  const height = safeNumber(process.env.CDEK_DEFAULT_HEIGHT_CM, 10);

  const client = getCdekClient();

  const payload = {
    type: 1,
    number: params.orderId,
    tariff_code: tariffCode,
    recipient: {
      name: params.recipientName,
      phones: [{ number: normalizePhone(params.recipientPhone) }],
    },
    from_location: {
      city: fromCity,
    },
    delivery_point: params.pvzCode,
    packages: [
      {
        number: `PKG-${params.orderId}`,
        weight,
        length,
        width,
        height,
        items: [
          {
            name: "SATL item",
            ware_key: `ORDER-${params.orderId}`,
            payment: { value: 0 },
            cost: 1000,
            amount: 1,
            weight,
          },
        ],
      },
    ],
  };

  console.log("[CDEK_WEBHOOK] register payload:", JSON.stringify(payload, null, 2));

  const created = await client.addOrder(payload);

  console.log("[CDEK_WEBHOOK] register success:", JSON.stringify(created, null, 2));

  const entity = (created as any)?.entity ?? null;

  const uuid = String(entity?.uuid ?? "").trim();
  const cdekNumber = String(entity?.cdek_number ?? "").trim();

  return {
    uuid: uuid || null,
    cdekNumber: cdekNumber || null,
    raw: created,
  };
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

  const track = params.trackNumber
    ? `\nТрек номер: <code>${params.trackNumber}</code>`
    : "";
  const text =
    `<b>Статус заказа изменён</b>\n` +
    `Заказ: <code>${params.orderId}</code>\n` +
    `Статус: <b>${statusLabel(params.status)}</b>` +
    `${track}\n\n` +
    `Ссылка: <a href="https://satl.shop/account/orders" target="_blank">Мои заказы</a>`;

  await tgSendMessage(u.tgChatId, text).catch(() => {});
}

/**
 * JSON вебхук статусов — вызывается из админки.
 * Тело: { orderId: string, status: "SHIPPED" | "DELIVERED" | ..., trackNumber?: string }
 * Заголовок: x-webhook-secret: <ORDER_STATUS_WEBHOOK_SECRET>
 */
async function handleStatusWebhook(req: Request) {
  const secret = req.headers.get("x-webhook-secret") || "";
  const expected = process.env.ORDER_STATUS_WEBHOOK_SECRET || "";

  if (!expected || secret !== expected) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }

  const orderId = String(body?.orderId ?? "").trim();
  const newStatus = String(body?.status ?? "").trim().toUpperCase();
  const newTrackNumber =
    body?.trackNumber != null ? String(body.trackNumber) : null;

  if (!orderId || !newStatus) {
    return Response.json(
      { ok: false, error: "orderId/status required" },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const prev = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, status: true, trackNumber: true },
    });
    if (!prev) return { ok: false as const, error: "Order not found" };

    const needUpdateTrack =
      newTrackNumber !== null && newTrackNumber !== prev.trackNumber;
    const needUpdateStatus =
      newStatus !== String(prev.status).toUpperCase();

    if (!needUpdateStatus && !needUpdateTrack) {
      return {
        ok: true as const,
        changed: false,
        order: prev,
        prevStatus: prev.status,
        newStatus: prev.status,
      };
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        ...(needUpdateStatus ? { status: newStatus as any } : {}),
        ...(needUpdateTrack ? { trackNumber: newTrackNumber } : {}),
      },
      select: { id: true, userId: true, status: true, trackNumber: true },
    });

    return {
      ok: true as const,
      changed: true,
      order: updated,
      prevStatus: prev.status,
      newStatus: updated.status,
    };
  });

  if (!result.ok) return Response.json(result, { status: 404 });

  const prevS = String((result as any).prevStatus ?? "").toUpperCase();
  const currS = String((result as any).newStatus ?? "").toUpperCase();

  if (prevS !== currS && (currS === "SHIPPED" || currS === "DELIVERED")) {
    const order = (result as any).order as {
      id: string;
      userId: string | null;
      status: any;
      trackNumber: string | null;
    };

    await notifyUserOrderStatus({
      userId: order.userId,
      orderId: order.id,
      status: String(order.status),
      trackNumber: order.trackNumber,
    });
  }

  return Response.json({ ok: true, changed: (result as any).changed });
}

/**
 * Yandex Pay webhook (JWT body) — оплата CAPTURED → создаём Order + уведомления
 */
async function handleYaPayWebhook(req: Request) {
  const jwt = (await req.text()).trim();

  console.log("✅ YAPAY WEBHOOK HIT");
  console.log("headers:", Object.fromEntries(req.headers.entries()));
  console.log("raw body:", jwt);

  const parts = jwt.split(".");
  if (parts.length !== 3) {
    console.log("❌ Bad JWT format");
    return Response.json({ ok: true });
  }

  const payloadStr = b64urlDecodeToString(parts[1]);
  const payload = JSON.parse(payloadStr);

  const orderId = String(payload?.order?.orderId || "");
  const paymentStatus = String(payload?.order?.paymentStatus || "");

  console.log("✅ YAPAY PAYLOAD:", { orderId, paymentStatus });

  if (!orderId) return Response.json({ ok: true });
  if (paymentStatus !== "CAPTURED") return Response.json({ ok: true });

  const draft = await prisma.paymentDraft.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      email: true,
      name: true,
      phone: true,
      address: true,
      itemsJson: true,
      total: true,
      status: true,
      trackNumber: true,

      pvzCity: true,
      pvzCode: true,
      pvzAddress: true,
      pvzName: true,
      deliveryPrice: true,
      deliveryDays: true,
    },
  });

  if (!draft) {
    console.log("❌ PaymentDraft not found:", orderId);
    return Response.json({ ok: true });
  }

  const already = await prisma.order.findUnique({
    where: { paymentDraftId: draft.id },
    select: { id: true },
  });

  if (already) {
    await prisma.paymentDraft.update({
      where: { id: draft.id },
      data: { status: "PAID" },
    });

    console.log("ℹ️ Order already exists:", already.id);
    return Response.json({ ok: true });
  }

  const items: any[] = Array.isArray(draft.itemsJson)
    ? (draft.itemsJson as any[])
    : [];

  const createdOrder = await prisma.$transaction(async (tx) => {
    await tx.paymentDraft.update({
      where: { id: draft.id },
      data: { status: "PAID" },
    });

    const order = await tx.order.create({
      data: {
        paymentDraftId: draft.id,
        userId: draft.userId ?? null,
        status: "NEW",
        total: draft.total,
        name: draft.name,
        phone: draft.phone,
        address: draft.address,

        pvzCity: draft.pvzCity ?? null,
        pvzCode: draft.pvzCode ?? null,
        pvzAddress: draft.pvzAddress ?? null,
        pvzName: draft.pvzName ?? null,
        deliveryPrice: draft.deliveryPrice ?? null,
        deliveryDays: draft.deliveryDays ?? null,

        trackNumber: draft.trackNumber ?? null,
        items: {
          create: items.map((it: any) => ({
            productId: String(it.productId),
            variantId: it.variantId ? String(it.variantId) : null,
            title: String(it.title ?? ""),
            price: Number(it.price ?? 0),
            quantity: Number(it.qty ?? it.quantity ?? 1),
          })),
        },
      },
      select: {
        id: true,
        userId: true,
        trackNumber: true,
        pvzCode: true,
        name: true,
        phone: true,
      },
    });

    for (const it of items) {
      const variantId = it?.variantId ? String(it.variantId) : null;
      const qty = Number(it?.qty ?? it?.quantity ?? 1);

      if (!variantId || !Number.isFinite(qty) || qty <= 0) continue;

      const updated = await tx.variant.updateMany({
        where: { id: variantId, stock: { gte: qty } },
        data: { stock: { decrement: qty } },
      });

      if (updated.count === 0) {
        console.log("⚠️ Stock not decremented (not enough):", { variantId, qty });
      }
    }

    return order;
  });

  let effectiveTrackNumber = createdOrder.trackNumber ?? null;

  if (createdOrder.pvzCode) {
    try {
      const cdek = await registerCdekOrder({
        orderId: createdOrder.id,
        recipientName: createdOrder.name,
        recipientPhone: createdOrder.phone,
        pvzCode: createdOrder.pvzCode,
      });

      if (cdek.cdekNumber && cdek.cdekNumber !== createdOrder.trackNumber) {
        await prisma.order.update({
          where: { id: createdOrder.id },
          data: { trackNumber: cdek.cdekNumber },
        });

        effectiveTrackNumber = cdek.cdekNumber;
      }

      console.log("✅ CDEK order registered:", {
        orderId: createdOrder.id,
        uuid: cdek.uuid,
        cdekNumber: cdek.cdekNumber,
      });
    } catch (e: any) {
      console.log(
        "❌ CDEK REGISTER ERROR:",
        JSON.stringify(extractCdekError(e), null, 2)
      );
    }
  } else {
    console.log("ℹ️ CDEK skipped: no pvzCode for order", createdOrder.id);
  }

  const adminChatIds = parseChatIds(process.env.TG_ADMIN_CHAT_IDS);

  const pvzLine = draft.pvzCode
    ? `ПВЗ: ${draft.pvzCity ? draft.pvzCity + ", " : ""}<code>${draft.pvzCode}</code>\nАдрес ПВЗ: ${draft.pvzAddress ?? "—"}\n`
    : "";

  const deliveryLine =
    draft.deliveryPrice != null
      ? `Доставка: ${rubFromCents(Number(draft.deliveryPrice))}${
          draft.deliveryDays != null ? ` (${draft.deliveryDays} дн.)` : ""
        }\n`
      : "";

  const adminText =
    `<b>Новый заказ ✅ (оплачен)</b>\n` +
    `ID: <code>${createdOrder.id}</code>\n` +
    `Имя: ${draft.name}\n` +
    `Телефон: ${draft.phone}\n` +
    `${pvzLine}` +
    `${deliveryLine}` +
    `Адрес: ${draft.address}\n` +
    `Пользователь: ${draft.email || "Не указан (клиент не авторизован)"}\n\n` +
    `<b>Состав заказа:</b>\n` +
    items
      .map((i) => {
        const title = String(i.title ?? "—");
        const q = Number(i.qty ?? i.quantity ?? 1);
        const price = Number(i.price ?? 0);
        return `• ${title} × ${q} = ${rubFromCents(price * q)}`;
      })
      .join("\n") +
    `\n\n<b>Итого:</b> ${rubFromCents(draft.total)}\n` +
    `Статус оплаты: <b>Оплачено ✅</b>\n` +
    `Трек номер: <code>${effectiveTrackNumber ?? "Не назначен"}</code>\n` +
    `Ссылка на заказ в админке: <a href="https://satl.shop/admin/orders/${createdOrder.id}" target="_blank">Перейти к заказу</a>\n` +
    `\n\n<b>Внимание!</b> Проверьте остатки товара и своевременно отправьте заказ клиенту.`;

  for (const chatId of adminChatIds) {
    tgSendMessage(chatId, adminText).catch(() => {});
  }

  if (draft.userId) {
    const u = await prisma.user.findUnique({
      where: { id: draft.userId },
      select: { tgChatId: true },
    });

    if (u?.tgChatId) {
      const userText =
        `<b>Заказ успешно оплачен ✅</b>\n` +
        `Номер заказа: <code>${createdOrder.id}</code>\n` +
        `Сумма: ${rubFromCents(draft.total)}\n\n` +
        `<b>Спасибо за покупку! 🎉</b>\n` +
        `Ваш заказ находится в обработке. Ожидайте уведомлений о доставке.\n\n` +
        `<b>Трек номер:</b> <code>${effectiveTrackNumber ?? "Не назначен"}</code>\n` +
        `Вы можете отслеживать статус: <a href="https://satl.shop/account/orders" target="_blank">Мои заказы</a>.`;

      tgSendMessage(u.tgChatId, userText).catch(() => {});
    }
  }

  console.log("✅ Order created from draft:", draft.id, "=>", createdOrder.id);
  return Response.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return await handleYaPayWebhook(req);
    }
    return await handleStatusWebhook(req);
  } catch (e: any) {
    console.log("❌ WEBHOOK ERROR:", e?.message || e);
    return Response.json({ ok: true });
  }
}