import { prisma } from "@/lib/prisma";
import { tgSendMessage, parseChatIds } from "@/lib/tg";

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

  const track = params.trackNumber ? `\nТрек номер: <code>${params.trackNumber}</code>` : "";
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
  if (!body) return Response.json({ ok: false, error: "Bad JSON" }, { status: 400 });

  const orderId = String(body?.orderId ?? "").trim();
  const newStatus = String(body?.status ?? "").trim().toUpperCase();
  const newTrackNumber = body?.trackNumber != null ? String(body.trackNumber) : null;

  if (!orderId || !newStatus) {
    return Response.json({ ok: false, error: "orderId/status required" }, { status: 400 });
  }

  // Меняем статус и (опционально) трек — и отправляем уведомление только на нужные статусы
  const result = await prisma.$transaction(async (tx) => {
    const prev = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, status: true, trackNumber: true },
    });
    if (!prev) return { ok: false as const, error: "Order not found" };

    const needUpdateTrack = newTrackNumber !== null && newTrackNumber !== prev.trackNumber;
    const needUpdateStatus = newStatus !== String(prev.status).toUpperCase();

    if (!needUpdateStatus && !needUpdateTrack) {
      return { ok: true as const, changed: false, order: prev, prevStatus: prev.status, newStatus: prev.status };
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        ...(needUpdateStatus ? { status: newStatus as any } : {}),
        ...(needUpdateTrack ? { trackNumber: newTrackNumber } : {}),
      },
      select: { id: true, userId: true, status: true, trackNumber: true },
    });

    return { ok: true as const, changed: true, order: updated, prevStatus: prev.status, newStatus: updated.status };
  });

  if (!result.ok) return Response.json(result, { status: 404 });

  // Уведомляем клиента только на SHIPPED/DELIVERED и только при переходе статуса
  const prevS = String((result as any).prevStatus ?? "").toUpperCase();
  const currS = String((result as any).newStatus ?? "").toUpperCase();

  if (prevS !== currS && (currS === "SHIPPED" || currS === "DELIVERED")) {
    const order = (result as any).order as { id: string; userId: string | null; status: any; trackNumber: string | null };

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

  // Только успешная оплата
  if (paymentStatus !== "CAPTURED") return Response.json({ ok: true });

  // Берём draft
  const draft = await prisma.paymentDraft.findUnique({
    where: { id: orderId },
  });

  if (!draft) {
    console.log("❌ PaymentDraft not found:", orderId);
    return Response.json({ ok: true });
  }

  // Если заказ уже создан — просто гарантируем статус PAID и выходим
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

  const items: any[] = Array.isArray(draft.itemsJson) ? (draft.itemsJson as any[]) : [];

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
        trackNumber: draft.trackNumber ?? null, // ✅ если есть
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
      select: { id: true },
    });

    // списание остатков (только по variantId)
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

  // TG уведомления админам
  const adminChatIds = parseChatIds(process.env.TG_ADMIN_CHAT_IDS);

  const adminText =
    `<b>Новый заказ ✅ (оплачен)</b>\n` +
    `ID: <code>${createdOrder.id}</code>\n` +
    `Имя: ${draft.name}\n` +
    `Телефон: ${draft.phone}\n` +
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
    `Трек номер: <code>${draft.trackNumber ?? "Не назначен"}</code>\n` +
    `Ссылка на заказ в админке: <a href="https://satl.shop/admin/orders/${createdOrder.id}" target="_blank">Перейти к заказу</a>\n` +
    `\n\n<b>Внимание!</b> Проверьте остатки товара и своевременно отправьте заказ клиенту.`;

  for (const chatId of adminChatIds) {
    tgSendMessage(chatId, adminText).catch(() => {});
  }

  // пользователю (оплата прошла)
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
        `<b>Трек номер:</b> <code>${draft.trackNumber ?? "Не назначен"}</code>\n` +
        `Вы можете отслеживать статус: <a href="https://satl.shop/account/orders" target="_blank">Мои заказы</a>.`;

      tgSendMessage(u.tgChatId, userText).catch(() => {});
    }
  }

  console.log("✅ Order created from draft:", draft.id, "=>", createdOrder.id);
  return Response.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    // Если тело похоже на JWT (yapay) — обрабатываем как YAPAY
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return await handleYaPayWebhook(req);
    }

    // Иначе считаем, что это webhook смены статуса (из админки)
    return await handleStatusWebhook(req);
  } catch (e: any) {
    console.log("❌ WEBHOOK ERROR:", e?.message || e);
    // Всегда 200, чтобы внешние сервисы не ретраили бесконечно
    return Response.json({ ok: true });
  }
}