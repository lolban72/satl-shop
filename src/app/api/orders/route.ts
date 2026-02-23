import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { tgSendMessage, parseChatIds } from "@/lib/tg";

const BodySchema = z.object({
  customer: z.object({
    name: z.string().min(2, "Имя слишком короткое"),
    phone: z.string().min(5, "Телефон слишком короткий"),
    address: z.string().min(5, "Адрес слишком короткий"),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().optional(),
        qty: z.coerce.number().int().min(1).max(99),
      })
    )
    .min(1),
});

function rubFromCents(cents: number) {
  return `${((cents ?? 0) / 100).toFixed(0)}р`;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = (session?.user as any)?.id as string | undefined;

    // ✅ 1) Обязательно логин
    if (!userId) {
      return Response.json(
        { error: "Нужно войти в аккаунт, чтобы оформить заказ" },
        { status: 401 }
      );
    }

    // ✅ 2) Берём пользователя из БД и проверяем Telegram + адрес
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tgChatId: true, address: true, email: true },
    });

    if (!user) {
      return Response.json({ error: "Пользователь не найден" }, { status: 401 });
    }

    // ✅ 3) Требуем привязку TG (иначе нельзя оформить)
    if (!user.tgChatId) {
      return Response.json(
        { error: "Привяжите Telegram в личном кабинете, чтобы оформить заказ" },
        { status: 403 }
      );
    }

    // ✅ 4) Требуем заполненный адрес в профиле
    if (!user.address || !user.address.trim()) {
      return Response.json(
        { error: "Заполните адрес доставки в личном кабинете" },
        { status: 400 }
      );
    }

    const body = BodySchema.parse(await req.json());

    const detailedItems: {
      productId: string;
      variantId?: string;
      title: string;
      price: number;
      quantity: number;
      variant?: { id: string; stock: number };
    }[] = [];

    let total = 0;

    for (const i of body.items) {
      const product = await prisma.product.findUnique({
        where: { id: i.productId },
        include: { variants: true },
      });

      if (!product) {
        return Response.json({ error: "Товар не найден" }, { status: 400 });
      }

      const variant = i.variantId
        ? product.variants.find((v) => v.id === i.variantId)
        : undefined;

      if (i.variantId && !variant) {
        return Response.json({ error: "Вариант товара не найден" }, { status: 400 });
      }

      if (variant && variant.stock < i.qty) {
        return Response.json(
          { error: `Недостаточно на складе: ${product.title}` },
          { status: 400 }
        );
      }

      total += product.price * i.qty;

      detailedItems.push({
        productId: product.id,
        variantId: variant?.id,
        title: product.title,
        price: product.price,
        quantity: i.qty,
        variant: variant ? { id: variant.id, stock: variant.stock } : undefined,
      });
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          total,
          name: body.customer.name,
          phone: body.customer.phone,
          address: body.customer.address,
          userId,
          items: {
            create: detailedItems.map((i) => ({
              productId: i.productId,
              variantId: i.variantId,
              title: i.title,
              price: i.price,
              quantity: i.quantity,
            })),
          },
        },
        select: { id: true },
      });

      // ✅ сохраняем данные пользователя
      await tx.user.update({
        where: { id: userId },
        data: {
          name: body.customer.name,
          phone: body.customer.phone,
          address: body.customer.address,
        },
      });

      // ✅ списание остатков
      for (const i of detailedItems) {
        if (i.variantId) {
          await tx.variant.update({
            where: { id: i.variantId },
            data: { stock: { decrement: i.quantity } },
          });
        }
      }

      return created;
    });

    // ===================================================
    // ✅ TG уведомления (только после успешного заказа)
    // ===================================================

    const adminChatIds = parseChatIds(process.env.TG_ADMIN_CHAT_IDS);

    // 1) админу — новый заказ (ВСЕГДА)
    const adminText =
      `<b>Новый заказ</b>\n` +
      `ID: <code>${order.id}</code>\n` +
      `Имя: ${body.customer.name}\n` +
      `Телефон: ${body.customer.phone}\n` +
      `Адрес: ${body.customer.address}\n\n` +
      `<b>Состав:</b>\n` +
      detailedItems
        .map((i) => `• ${i.title} × ${i.quantity} = ${rubFromCents(i.price * i.quantity)}`)
        .join("\n") +
      `\n\n<b>Итого:</b> ${rubFromCents(total)}\n` +
      `Админка: https://satl.shop/admin/orders/${order.id}`;

    for (const chatId of adminChatIds) {
      tgSendMessage(chatId, adminText).catch(() => {});
    }

    // 2) пользователю — заказ принят ✅ (если привязан TG)
    if (user.tgChatId) {
      const userText =
        `<b>Заказ принят ✅</b>\n` +
        `Номер: <code>${order.id}</code>\n` +
        `Сумма: ${rubFromCents(total)}\n\n`;

      tgSendMessage(user.tgChatId, userText).catch(() => {});
    }

    return Response.json({ ok: true, orderId: order.id });
  } catch (e: any) {
    const msg = e?.issues?.[0]?.message || e?.message || "Ошибка обработки заказа";
    return Response.json({ error: msg }, { status: 400 });
  }
}