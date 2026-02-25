import { prisma } from "@/lib/prisma";

function rub2(totalCents: number) {
  return (Number(totalCents || 0) / 100).toFixed(2);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const draftId = String(body?.draftId || "").trim();

    if (!draftId) {
      return Response.json({ error: "draftId required" }, { status: 400 });
    }

    const draft = await prisma.paymentDraft.findUnique({
      where: { id: draftId },
      select: { id: true, total: true, itemsJson: true },
    });

    if (!draft) {
      return Response.json({ error: "draft not found" }, { status: 404 });
    }

    const merchantId = process.env.NEXT_PUBLIC_YAPAY_MERCHANT_ID || "";
    if (!merchantId) {
      return Response.json(
        { error: "NEXT_PUBLIC_YAPAY_MERCHANT_ID is missing" },
        { status: 500 }
      );
    }

    // В sandbox API-Key = merchantId (по докам)
    // В production нужно выпустить API key в Merchant Console и хранить его в env
    const isProd = process.env.NEXT_PUBLIC_YAPAY_ENV === "PRODUCTION";
    const apiKey = isProd ? (process.env.YAPAY_API_KEY || "") : merchantId;

    if (isProd && !apiKey) {
      return Response.json({ error: "YAPAY_API_KEY is missing" }, { status: 500 });
    }

    const baseUrl = isProd
      ? "https://pay.yandex.ru/api/merchant/v1/orders"
      : "https://sandbox.pay.yandex.ru/api/merchant/v1/orders";

    // itemsJson у тебя хранится как JSONB (как ты создавал draft).
    // Ожидаем массив товаров вида:
    // [{ productId, title, qty, priceCents }, ...]
    const rawItems: any[] = Array.isArray(draft.itemsJson) ? draft.itemsJson : [];

    const items = rawItems.map((it, idx) => {
      const productId = String(it?.productId ?? `item-${idx}`);
      const title = String(it?.title ?? "Товар");
      const qty = Number(it?.qty ?? 1);

      // у тебя price в корзине = cents (копейки)
      const priceCents = Number(it?.price ?? it?.priceCents ?? 0);
      const lineTotalCents = priceCents * qty;

      return {
        productId,
        title,
        quantity: { count: String(qty) }, // в примерах допускается строка
        total: rub2(lineTotalCents),
      };
    });

    const payload = {
      orderId: draft.id,
      merchantId,
      currencyCode: "RUB",
      availablePaymentMethods: ["CARD", "SPLIT"],
      ttl: 1800,
      redirectUrls: {
        onSuccess: `https://satl.shop/pay/success/${encodeURIComponent(draft.id)}`,
        onError: `https://satl.shop/pay/error/${encodeURIComponent(draft.id)}`,
      },
      cart: {
        items,
        total: { amount: rub2(draft.total) },
      },
    };

    const r = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Api-Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      // чтобы видеть реальную причину
      return Response.json(
        { error: "Yandex Pay order create failed", details: data },
        { status: 500 }
      );
    }

    const paymentUrl = data?.data?.paymentUrl;
    if (!paymentUrl) {
      return Response.json(
        { error: "paymentUrl missing in response", details: data },
        { status: 500 }
      );
    }

    return Response.json({ paymentUrl });
  } catch (e: any) {
    return Response.json({ error: e?.message || "link error" }, { status: 500 });
  }
}