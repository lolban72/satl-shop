import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

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

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = (session?.user as any)?.id as string | undefined;

    if (!userId) {
      return Response.json(
        { error: "Нужно войти в аккаунт, чтобы оформить заказ" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tgChatId: true, address: true, email: true },
    });

    if (!user) {
      return Response.json({ error: "Пользователь не найден" }, { status: 401 });
    }

    if (!user.tgChatId) {
      return Response.json(
        { error: "Привяжите Telegram в личном кабинете, чтобы оформить заказ" },
        { status: 403 }
      );
    }

    if (!user.address || !user.address.trim()) {
      return Response.json(
        { error: "Заполните адрес доставки в личном кабинете" },
        { status: 400 }
      );
    }

    const body = BodySchema.parse(await req.json());

    // ✅ считаем total и собираем itemsJson (с title/price)
    let total = 0;

    const itemsJson: any[] = [];

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
        return Response.json(
          { error: "Вариант товара не найден" },
          { status: 400 }
        );
      }

      if (variant && variant.stock < i.qty) {
        return Response.json(
          { error: `Недостаточно на складе: ${product.title}` },
          { status: 400 }
        );
      }

      total += product.price * i.qty;

      itemsJson.push({
        productId: product.id,
        variantId: variant?.id ?? null,
        qty: i.qty,
        title: product.title,
        price: product.price,
      });
    }

    // ✅ сохраняем данные пользователя (можно оставить тут)
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: body.customer.name,
        phone: body.customer.phone,
        address: body.customer.address,
      },
    });

    // ✅ создаём только draft (Order создаст webhook после оплаты)
    const draft = await prisma.paymentDraft.create({
      data: {
        userId,
        email: user.email ?? null,
        name: body.customer.name,
        phone: body.customer.phone,
        address: body.customer.address,
        itemsJson,
        total,
        status: "PENDING",
      },
      select: { id: true },
    });

    return Response.json({ draftId: draft.id });
  } catch (e: any) {
    const msg = e?.issues?.[0]?.message || e?.message || "Ошибка обработки заказа";
    return Response.json({ error: msg }, { status: 400 });
  }
}