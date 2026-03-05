import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

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

    // ✅ теперь address с клиента НЕ обязателен как "уличный адрес"
    // потому что доставка только в ПВЗ. Можно оставить как fallback.
    const address = String(body?.address ?? "").trim();

    // ✅ новые поля для СДЭК ПВЗ (приходят с клиента после выбора на карте)
    const city = String(body?.city ?? "").trim(); // например "Краснодар"
    const pvzCode = String(body?.pvzCode ?? "").trim(); // код ПВЗ СДЭК
    const pvzAddress = String(body?.pvzAddress ?? "").trim(); // адрес ПВЗ

    const items = Array.isArray(body?.items) ? body.items : [];

    // ✅ имя/телефон обязательны
    if (!name || !phone) {
      return Response.json(
        { error: "Заполните имя/телефон" },
        { status: 400 }
      );
    }

    // ✅ выбор города + ПВЗ обязателен (потому что доставка только в ПВЗ)
    if (!city || !pvzCode || !pvzAddress) {
      return Response.json(
        { error: "Выберите город и ПВЗ СДЭК" },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return Response.json({ error: "Корзина пуста" }, { status: 400 });
    }

    // ✅ берём email + tgChatId из БД (а не с клиента)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, tgChatId: true, address: true },
    });

    if (!user) {
      return Response.json({ error: "Пользователь не найден" }, { status: 401 });
    }

    // ✅ требуем TG привязку
    if (!user.tgChatId) {
      return Response.json(
        { error: "Привяжите Telegram в личном кабинете, чтобы оформить заказ" },
        { status: 403 }
      );
    }

    // ✅ адрес в профиле больше НЕ обязателен, потому что доставка в ПВЗ
    // (оставляем проверку выключенной)
    // if (!user.address || !user.address.trim()) {
    //   return Response.json(
    //     { error: "Заполните адрес доставки в личном кабинете" },
    //     { status: 400 }
    //   );
    // }

    // ✅ пересчёт total (в копейках) из items
    const total = items.reduce((s: number, it: any) => {
      const price = Number(it?.price) || 0; // копейки
      const qty = Number(it?.qty) || 0;
      return s + price * qty;
    }, 0);

    if (total <= 0) {
      return Response.json({ error: "Некорректная сумма" }, { status: 400 });
    }

    // ✅ address, который сохраняем в draft:
    // приоритет — адрес выбранного ПВЗ, иначе fallback на то, что прислали
    const finalAddress = pvzAddress || address;

    const draft = await prisma.paymentDraft.create({
      data: {
        userId, // ✅ ВАЖНО
        email: user.email ?? null, // ✅ из БД
        name,
        phone,

        // ✅ сохраняем адрес = адрес ПВЗ (так у тебя уже везде используется draft.address)
        address: finalAddress,

        // ✅ новые поля (должны быть добавлены в Prisma и миграцией)
        pvzCode,
        pvzAddress,
        // deliveryPrice/deliveryDays добавим следующим шагом после калькулятора СДЭК
        // deliveryPrice: null,
        // deliveryDays: null,

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