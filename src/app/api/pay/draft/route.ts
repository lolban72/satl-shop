import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return Response.json({ error: "Bad JSON" }, { status: 400 });
    }

    const name = String(body?.name ?? "").trim();
    const phone = String(body?.phone ?? "").trim();
    const address = String(body?.address ?? "").trim();
    const email = body?.email ? String(body.email).trim().toLowerCase() : null;

    const items = Array.isArray(body?.items) ? body.items : [];

    if (!name || !phone || !address) {
      return Response.json({ error: "Заполните имя/телефон/адрес" }, { status: 400 });
    }
    if (items.length === 0) {
      return Response.json({ error: "Корзина пуста" }, { status: 400 });
    }

    const total = items.reduce((s: number, it: any) => {
      const price = Number(it?.price) || 0; // копейки
      const qty = Number(it?.qty) || 0;
      return s + price * qty;
    }, 0);

    if (total <= 0) {
      return Response.json({ error: "Некорректная сумма" }, { status: 400 });
    }

    // 👇 если модели нет / prisma client старый — упадёт здесь, но мы это поймаем
    const draft = await prisma.paymentDraft.create({
      data: {
        userId: null, // пока без auth
        email,
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

    // покажем понятную ошибку на клиенте (временно, пока отлаживаем)
    return Response.json(
      { error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}