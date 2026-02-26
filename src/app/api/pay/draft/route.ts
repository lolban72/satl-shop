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
    const address = String(body?.address ?? "").trim();

    const items = Array.isArray(body?.items) ? body.items : [];

    if (!name || !phone || !address) {
      return Response.json(
        { error: "Заполните имя/телефон/адрес" },
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

    // ✅ требуем адрес в профиле (чтобы не расходилось)
    if (!user.address || !user.address.trim()) {
      return Response.json(
        { error: "Заполните адрес доставки в личном кабинете" },
        { status: 400 }
      );
    }

    // ✅ пересчёт total (в копейках) из items
    const total = items.reduce((s: number, it: any) => {
      const price = Number(it?.price) || 0; // копейки
      const qty = Number(it?.qty) || 0;
      return s + price * qty;
    }, 0);

    if (total <= 0) {
      return Response.json({ error: "Некорректная сумма" }, { status: 400 });
    }

    const draft = await prisma.paymentDraft.create({
      data: {
        userId, // ✅ ВАЖНО
        email: user.email ?? null, // ✅ из БД
        name,
        phone,
        address,
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