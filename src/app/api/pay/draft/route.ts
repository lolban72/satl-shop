import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

function addDeliveryFee(deliveryPriceCents: number) {
  if (!Number.isFinite(deliveryPriceCents) || deliveryPriceCents <= 0) return 0;
  return deliveryPriceCents + Math.round(deliveryPriceCents * 0.1);
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = (session?.user as any)?.id as string | undefined;

    if (!userId) {
      return Response.json(
        { error: "Нужно войти в аккаунт, чтобы перейти к оплате" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return Response.json({ error: "Bad JSON" }, { status: 400 });
    }

    const name = String(body?.name ?? "").trim();
    const phone = String(body?.phone ?? "").trim();

    const address = String(body?.address ?? "").trim();

    const city = String(body?.city ?? "").trim();
    const pvzCode = String(body?.pvzCode ?? "").trim();
    const pvzAddress = String(body?.pvzAddress ?? "").trim();
    const pvzName = body?.pvzName != null ? String(body.pvzName).trim() : null;

    const promoCodeRaw = String(body?.promoCode ?? "").trim();
    const promoCodeNormalized = promoCodeRaw.toUpperCase();

    const deliveryPriceRaw =
      body?.deliveryPrice != null ? Number(body.deliveryPrice) : null;
    const deliveryDaysRaw =
      body?.deliveryDays != null ? Number(body.deliveryDays) : null;
    const tariffCodeRaw =
      body?.tariffCode != null ? Number(body.tariffCode) : null;

    const deliveryPriceBase =
      deliveryPriceRaw != null && Number.isFinite(deliveryPriceRaw)
        ? Math.round(deliveryPriceRaw)
        : null;

    const deliveryDays =
      deliveryDaysRaw != null && Number.isFinite(deliveryDaysRaw)
        ? Math.round(deliveryDaysRaw)
        : null;

    const tariffCode =
      tariffCodeRaw != null && Number.isFinite(tariffCodeRaw) && tariffCodeRaw > 0
        ? Math.round(tariffCodeRaw)
        : null;

    const items = Array.isArray(body?.items) ? body.items : [];

    if (!name || !phone) {
      return Response.json({ error: "Заполните имя/телефон" }, { status: 400 });
    }

    if (!city || !pvzCode || !pvzAddress) {
      return Response.json(
        { error: "Выберите город и ПВЗ СДЭК" },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return Response.json({ error: "Корзина пуста" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, tgChatId: true },
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

    const itemsTotal = items.reduce((sum: number, it: any) => {
      const price = Number(it?.price) || 0;
      const qty = Number(it?.qty ?? it?.quantity) || 0;
      return sum + price * qty;
    }, 0);

    if (itemsTotal <= 0) {
      return Response.json({ error: "Некорректная сумма" }, { status: 400 });
    }

    if (deliveryPriceBase == null || deliveryPriceBase < 0) {
      return Response.json(
        { error: "deliveryPrice required (calc delivery first)" },
        { status: 400 }
      );
    }

    if (tariffCode == null) {
      return Response.json(
        { error: "tariffCode required (calc delivery first)" },
        { status: 400 }
      );
    }

    let promoId: string | null = null;
    let appliedPromoCode: string | null = null;
    let discount = 0;

    if (promoCodeNormalized) {
      const promo = await prisma.promoCode.findUnique({
        where: { code: promoCodeNormalized },
      });

      if (!promo || !promo.isActive) {
        return Response.json({ error: "Промокод недействителен" }, { status: 400 });
      }

      if (promo.expiresAt && promo.expiresAt < new Date()) {
        return Response.json(
          { error: "Срок действия промокода истёк" },
          { status: 400 }
        );
      }

      if (
        promo.maxUses !== null &&
        promo.maxUses !== undefined &&
        promo.usedCount >= promo.maxUses
      ) {
        return Response.json(
          { error: "Лимит использований промокода исчерпан" },
          { status: 400 }
        );
      }

      if (
        promo.minOrderTotal !== null &&
        promo.minOrderTotal !== undefined &&
        itemsTotal < promo.minOrderTotal
      ) {
        return Response.json(
          { error: "Сумма заказа слишком маленькая для этого промокода" },
          { status: 400 }
        );
      }

      if (promo.discountType === "percent") {
        discount = Math.round((itemsTotal * promo.discountValue) / 100);
      } else if (promo.discountType === "fixed") {
        discount = promo.discountValue;
      }

      if (discount > itemsTotal) {
        discount = itemsTotal;
      }

      promoId = promo.id;
      appliedPromoCode = promo.code;
    }

    const deliveryTax = Math.round(deliveryPriceBase * 0.1);
    const deliveryPrice = addDeliveryFee(deliveryPriceBase);
    const total = Math.max(itemsTotal - discount, 0) + deliveryPrice;
    const finalAddress = pvzAddress || address;

    const draft = await prisma.paymentDraft.create({
      data: {
        userId,
        email: user.email ?? null,
        name,
        phone,
        address: finalAddress,

        pvzCity: city,
        pvzCode,
        pvzAddress,
        pvzName,

        deliveryPrice,
        deliveryDays,
        tariffCode,

        promoCodeId: promoId,
        promoCode: appliedPromoCode,
        discount,
        deliveryTax,

        itemsJson: items,
        total,
        status: "PENDING",
      },
      select: { id: true },
    });

    return Response.json({
      draftId: draft.id,
      total,
      itemsTotal,
      discount,
      promoCode: appliedPromoCode,
      deliveryPrice,
      deliveryTax,
      tariffCode,
    });
  } catch (e: any) {
    console.error("api/pay/draft error:", e);
    return Response.json(
      { error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}