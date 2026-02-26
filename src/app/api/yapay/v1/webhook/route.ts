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

export async function POST(req: Request) {
  try {
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

    // itemsJson у тебя Json => ожидаем массив
    const items: any[] = Array.isArray(draft.itemsJson) ? (draft.itemsJson as any[]) : [];

    // Транзакция: пометить draft, создать order, списать остатки
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

      // ✅ списание остатков (только по variantId)
      for (const it of items) {
        const variantId = it?.variantId ? String(it.variantId) : null;
        const qty = Number(it?.qty ?? it?.quantity ?? 1);

        if (!variantId || !Number.isFinite(qty) || qty <= 0) continue;

        // безопасное списание — не уйдём в минус
        const updated = await tx.variant.updateMany({
          where: { id: variantId, stock: { gte: qty } },
          data: { stock: { decrement: qty } },
        });

        if (updated.count === 0) {
          // если не списалось — значит на момент webhook нет стока
          // можно либо кидать ошибку (откатит транзакцию), либо логировать.
          // Я логирую и продолжаю, чтобы заказ создался.
          console.log("⚠️ Stock not decremented (not enough):", { variantId, qty });
        }
      }

      return order;
    });

    // ✅ TG уведомления (после успешного создания заказа)
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
    `Ссылка на заказ в админке: <a href="https://satl.shop/admin/orders/${createdOrder.id}" target="_blank">Перейти к заказу</a>\n` +
    `\n\n<b>Внимание!</b> Проверьте остатки товара и своевременно отправьте заказ клиенту.`;

  for (const chatId of adminChatIds) {
    tgSendMessage(chatId, adminText).catch(() => {});
  }

    // пользователю
    if (draft.userId) {
      const u = await prisma.user.findUnique({
        where: { id: draft.userId },
        select: { tgChatId: true },
      });

      if (u?.tgChatId) {
        const userText =
          `<b>Заказ оплачен ✅</b>\n` +
          `Номер: <code>${createdOrder.id}</code>\n` +
          `Сумма: ${rubFromCents(draft.total)}\n\n` +
          `Спасибо за покупку!`;

        tgSendMessage(u.tgChatId, userText).catch(() => {});
      }
    }

    console.log("✅ Order created from draft:", draft.id, "=>", createdOrder.id);

    return Response.json({ ok: true });
  } catch (e: any) {
    console.log("❌ YAPAY WEBHOOK ERROR:", e?.message || e);
    // Всегда 200, чтобы Yandex Pay не ретраил бесконечно
    return Response.json({ ok: true });
  }
}