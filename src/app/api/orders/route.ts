import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const BodySchema = z.object({
  customer: z.object({
    name: z.string().min(2, "Имя слишком короткое"),
    phone: z.string().min(5, "Телефон слишком короткий"),
    address: z.string().min(5, "Адрес слишком короткий"),
  }),
  deliveryPrice: z.coerce.number().int().min(0, "Некорректная стоимость доставки"),
  promoCode: z.string().trim().optional(),
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

    // считаем subtotal и собираем itemsJson
    let subtotal = 0;
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

      subtotal += product.price * i.qty;

      itemsJson.push({
        productId: product.id,
        variantId: variant?.id ?? null,
        qty: i.qty,
        title: product.title,
        price: product.price,
      });
    }

    // промокод применяется к товарам до доставки
    let discount = 0;
    let promoId: string | null = null;
    let appliedPromoCode: string | null = null;

    if (body.promoCode) {
      const normalizedCode = body.promoCode.trim().toUpperCase();

      const promo = await prisma.promoCode.findUnique({
        where: { code: normalizedCode },
      });

      if (!promo || !promo.isActive) {
        return Response.json({ error: "Промокод недействителен" }, { status: 400 });
      }

      if (promo.expiresAt && promo.expiresAt < new Date()) {
        return Response.json({ error: "Срок действия промокода истёк" }, { status: 400 });
      }

      if (promo.maxUses !== null && promo.maxUses !== undefined && promo.usedCount >= promo.maxUses) {
        return Response.json({ error: "Лимит использований промокода исчерпан" }, { status: 400 });
      }

      if (
        promo.minOrderTotal !== null &&
        promo.minOrderTotal !== undefined &&
        subtotal < promo.minOrderTotal
      ) {
        return Response.json(
          { error: "Сумма заказа слишком маленькая для этого промокода" },
          { status: 400 }
        );
      }

      if (promo.discountType === "percent") {
        discount = Math.round((subtotal * promo.discountValue) / 100);
      } else if (promo.discountType === "fixed") {
        discount = promo.discountValue;
      }

      if (discount > subtotal) {
        discount = subtotal;
      }

      promoId = promo.id;
      appliedPromoCode = promo.code;
    }

    // добавляем доставку + 10% от доставки
    const deliveryPrice = body.deliveryPrice;
    const deliveryTax = Math.round(deliveryPrice * 0.1);

    let total = subtotal - discount + deliveryPrice + deliveryTax;

    if (total < 0) total = 0;

    // сохраняем данные пользователя
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: body.customer.name,
        phone: body.customer.phone,
        address: body.customer.address,
      },
    });

    // создаём только draft (Order создаст webhook после оплаты)
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
        promoCodeId: promoId,
        promoCode: appliedPromoCode,
        discount,
        deliveryPrice,
        deliveryTax,
      },
      select: { id: true },
    });

    return Response.json({
      draftId: draft.id,
      total,
      subtotal,
      discount,
      deliveryPrice,
      deliveryTax,
      promoCode: appliedPromoCode,
    });
  } catch (e: any) {
    const msg = e?.issues?.[0]?.message || e?.message || "Ошибка обработки заказа";
    return Response.json({ error: msg }, { status: 400 });
  }
}