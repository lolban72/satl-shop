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
    // ✅ Yandex Pay присылает НЕ JSON, а JWT строку (как в твоих логах)
    const raw = (await req.text()).trim();
    if (!raw) return Response.json({ ok: true });

    const parts = raw.split(".");
    if (parts.length !== 3) {
      console.log("❌ YAPAY webhook: not a JWT");
      return Response.json({ ok: true });
    }

    const payloadStr = b64urlDecodeToString(parts[1]);
    const payload = JSON.parse(payloadStr);

    const orderId = String(payload?.order?.orderId || "").trim(); // это draftId
    const paymentStatus = String(payload?.order?.paymentStatus || "").trim(); // CAPTURED и т.п.

    if (!orderId) return Response.json({ ok: true });

    // ✅ успех оплаты
    if (paymentStatus === "CAPTURED") {
      const draft = await prisma.paymentDraft.findUnique({
        where: { id: orderId },
      });

      if (!draft) return Response.json({ ok: true });

      // ✅ если уже PAID — ничего не делаем (идемпотентность)
      // (или если заказ уже есть — тоже)
      const existing = await prisma.order.findUnique({
        where: { paymentDraftId: draft.id },
        select: { id: true },
      });
      if (existing) {
        if (draft.status !== "PAID") {
          await prisma.paymentDraft.update({
            where: { id: draft.id },
            data: { status: "PAID" },
          });
        }
        return Response.json({ ok: true });
      }

      const items = Array.isArray(draft.itemsJson) ? (draft.itemsJson as any[]) : [];

      const createdOrder = await prisma.$transaction(async (tx) => {
        // 1) помечаем draft как PAID
        await tx.paymentDraft.update({
          where: { id: draft.id },
          data: { status: "PAID" },
        });

        // 2) создаём заказ
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
                variantId: it?.variantId ? String(it.variantId) : null,
                title: String(it.title ?? ""),
                price: Number(it.price) || 0,
                quantity: Number(it.qty ?? it.quantity ?? 1) || 1,
              })),
            },
          },
          select: { id: true },
        });

        // 3) ✅ списание остатков (по variantId)
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

      // ✅ TG админу
      const adminChatIds = parseChatIds(process.env.TG_ADMIN_CHAT_IDS);

      const adminText =
        `<b>Новый заказ ✅ (оплачен)</b>\n` +
        `ID: <code>${createdOrder.id}</code>\n` +
        `Имя: ${draft.name}\n` +
        `Телефон: ${draft.phone}\n` +
        `Адрес: ${draft.address}\n\n` +
        `<b>Состав:</b>\n` +
        items
          .map((i) => {
            const title = String(i.title ?? "—");
            const q = Number(i.qty ?? i.quantity ?? 1);
            const price = Number(i.price ?? 0);
            return `• ${title} × ${q} = ${rubFromCents(price * q)}`;
          })
          .join("\n") +
        `\n\n<b>Итого:</b> ${rubFromCents(draft.total)}\n` +
        `Админка: https://satl.shop/admin/orders/${createdOrder.id}`;

      for (const chatId of adminChatIds) {
        tgSendMessage(chatId, adminText).catch(() => {});
      }

      // ✅ TG пользователю: по userId, fallback по email
      let userChatId: string | null = null;

      if (draft.userId) {
        const u = await prisma.user.findUnique({
          where: { id: draft.userId },
          select: { tgChatId: true },
        });
        userChatId = u?.tgChatId ?? null;
      }

      if (!userChatId && draft.email) {
        const u2 = await prisma.user.findUnique({
          where: { email: draft.email },
          select: { tgChatId: true },
        });
        userChatId = u2?.tgChatId ?? null;
      }

      if (userChatId) {
        const userText =
          `<b>Заказ оплачен ✅</b>\n` +
          `Номер: <code>${createdOrder.id}</code>\n` +
          `Сумма: ${rubFromCents(draft.total)}\n\n` +
          `Спасибо за покупку!`;

        tgSendMessage(userChatId, userText).catch(() => {});
      } else {
        console.log("⚠️ No tgChatId for user", {
          draftId: draft.id,
          userId: draft.userId,
          email: draft.email,
        });
      }

      return Response.json({ ok: true });
    }

    // ❌ неуспех
    if (paymentStatus === "FAILED" || paymentStatus === "CANCELLED") {
      await prisma.paymentDraft
        .update({
          where: { id: orderId },
          data: { status: paymentStatus === "FAILED" ? "FAILED" : "CANCELED" },
        })
        .catch(() => {});
    }

    // всегда 200
    return Response.json({ ok: true });
  } catch (e: any) {
    console.log("❌ YAPAY WEBHOOK ERROR:", e?.message || e);
    return Response.json({ ok: true });
  }
}