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

    // доставка только в ПВЗ — address будет адресом ПВЗ
    const address = String(body?.address ?? "").trim();

    // СДЭК ПВЗ
    const city = String(body?.city ?? "").trim();
    const pvzCode = String(body?.pvzCode ?? "").trim();
    const pvzAddress = String(body?.pvzAddress ?? "").trim();

    // имя ПВЗ (опционально)
    const pvzName = body?.pvzName != null ? String(body.pvzName).trim() : null;

    // доставка (копейки + дни) — приходит с фронта после /api/cdek/calc
    const deliveryPriceRaw =
      body?.deliveryPrice != null ? Number(body.deliveryPrice) : null;
    const deliveryDaysRaw =
      body?.deliveryDays != null ? Number(body.deliveryDays) : null;

    const deliveryPriceBase =
      deliveryPriceRaw != null && Number.isFinite(deliveryPriceRaw)
        ? Math.round(deliveryPriceRaw)
        : null;

    const deliveryDays =
      deliveryDaysRaw != null && Number.isFinite(deliveryDaysRaw)
        ? Math.round(deliveryDaysRaw)
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

    // пересчёт товаров (копейки)
    const itemsTotal = items.reduce((sum: number, it: any) => {
      const price = Number(it?.price) || 0;
      const qty = Number(it?.qty) || 0;
      return sum + price * qty;
    }, 0);

    if (itemsTotal <= 0) {
      return Response.json({ error: "Некорректная сумма" }, { status: 400 });
    }

    // доставка обязательна
    if (deliveryPriceBase == null || deliveryPriceBase < 0) {
      return Response.json(
        { error: "deliveryPrice required (calc delivery first)" },
        { status: 400 }
      );
    }

    // +10% к доставке — обязательно
    const deliveryPrice = addDeliveryFee(deliveryPriceBase);

    // итоговая сумма заказа
    const total = itemsTotal + deliveryPrice;

    const finalAddress = pvzAddress || address;

    const draft = await prisma.paymentDraft.create({
      data: {
        userId,
        email: user.email ?? null,
        name,
        phone,
        address: finalAddress,

        // ПВЗ
        pvzCity: city,
        pvzCode,
        pvzAddress,
        pvzName,

        // сохраняем уже доставку С НАЦЕНКОЙ
        deliveryPrice,
        deliveryDays,

        itemsJson: items,
        total,
        status: "PENDING",
      },
      select: { id: true },
    });

    return Response.json({ draftId: draft.id });
  } catch (e: any) {
    console.error("api/pay/draft error:", e);
    return Response.json(
      { error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}