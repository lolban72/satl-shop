import { prisma } from "@/lib/prisma";
import { tgSendMessage, parseChatIds } from "@/lib/tg";
import JsBarcode from "jsbarcode";
import { Buffer } from "node:buffer";

// Функция для генерации штрихкода
function generateBarcode(orderId: string): string {
  const canvas = document.createElement("canvas"); // создаём canvas
  JsBarcode(canvas, orderId, {
    format: "CODE128",    // Формат штрихкода
    lineColor: "#000",    // Цвет линий
    width: 2,             // Ширина линии штрихкода
    height: 70,           // Высота штрихкода
    displayValue: false,  // Не показывать текстовое значение
    margin: 0,            // Убираем отступы
  });

  // Получаем изображение штрихкода как base64 строку
  return canvas.toDataURL("image/png"); // Возвращаем PNG как base64
}


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
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      console.log("❌ Bad JWT format");
      return Response.json({ ok: true });
    }

    const payloadStr = b64urlDecodeToString(parts[1]);
    const payload = JSON.parse(payloadStr);

    const orderId = String(payload?.order?.orderId || "");
    const paymentStatus = String(payload?.order?.paymentStatus || "");

    if (!orderId) return Response.json({ ok: true });

    // Обработка CAPTURED статуса
    if (paymentStatus === "CAPTURED") {
      const draft = await prisma.paymentDraft.findUnique({
        where: { id: orderId },
      });

      if (!draft) return Response.json({ ok: true });

      const items = Array.isArray(draft.itemsJson) ? draft.itemsJson : [];

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
                price: Number(it.price) || 0,
                quantity: Number(it.qty ?? it.quantity ?? 1),
              })),
            },
          },
          select: { id: true },
        });

        // списание остатков
        for (const it of items) {
          const variantId = it?.variantId ? String(it.variantId) : null;
          const qty = Number(it?.qty ?? it?.quantity ?? 1);

          if (!variantId || !Number.isFinite(qty) || qty <= 0) continue;

          await tx.variant.updateMany({
            where: { id: variantId, stock: { gte: qty } },
            data: { stock: { decrement: qty } },
          });
        }

        return order;
      });

      // Генерация штрихкода
      const barcodeSvg = generateBarcode(createdOrder.id);

      // Уведомление админу
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
        `Трек номер: <code>${draft.trackNumber ?? "Не назначен"}</code>\n` + 
        `Ссылка на заказ в админке: <a href="https://satl.shop/admin/orders/${createdOrder.id}" target="_blank">Перейти к заказу</a>\n`;

      for (const chatId of adminChatIds) {
        tgSendMessage(chatId, adminText).catch(() => {});
      }

      // Уведомление клиенту с штрихкодом
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
            `Для получения товара покажите следующий штрихкод:\n` +
            `<pre>${barcodeSvg}</pre>\n\n` +
            `Если у вас есть вопросы, напишите нам в <a href="https://web.telegram.org/k/#@MANAGER_SATL_SHOP">Телеграм</a> или отправьте email на <a href="mailto:Satl.Shop.ru@gmail.com">Satl.Shop.ru@gmail.com</a>.\n` +
            `\n\n` +
            `Вы можете также отслеживать статус заказа в вашем личном кабинете на сайте <a href="https://satl.shop/account/orders" target="_blank">Мои заказы</a>.`;

          tgSendMessage(u.tgChatId, userText).catch(() => {});
        }
      }

      return Response.json({ ok: true });
    }

    // Если оплата не прошла
    if (paymentStatus === "FAILED" || paymentStatus === "CANCELLED") {
      await prisma.paymentDraft
        .update({
          where: { id: orderId },
          data: { status: paymentStatus === "FAILED" ? "FAILED" : "CANCELED" },
        })
        .catch(() => {});
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    console.log("❌ YAPAY WEBHOOK ERROR:", e?.message || e);
    return Response.json({ ok: true });
  }
}