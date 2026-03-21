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
      select: {
        id: true,
        total: true,
        itemsJson: true,
        deliveryPrice: true,
        pvzCity: true,
        pvzAddress: true,
        promoCode: true,
        discount: true,
      },
    });

    if (!draft) {
      return Response.json({ error: "draft not found" }, { status: 404 });
    }

    const merchantId =
      process.env.YAPAY_MERCHANT_ID ||
      process.env.NEXT_PUBLIC_YAPAY_MERCHANT_ID ||
      "";

    if (!merchantId) {
      return Response.json(
        { error: "YAPAY_MERCHANT_ID is missing" },
        { status: 500 }
      );
    }

    const isProd = process.env.NEXT_PUBLIC_YAPAY_ENV === "PRODUCTION";
    const apiKey = isProd ? process.env.YAPAY_API_KEY || "" : merchantId;

    if (isProd && !apiKey) {
      return Response.json(
        { error: "YAPAY_API_KEY is missing" },
        { status: 500 }
      );
    }

    const baseUrl = isProd
      ? "https://pay.yandex.ru/api/merchant/v1/orders"
      : "https://sandbox.pay.yandex.ru/api/merchant/v1/orders";

    const rawItems: any[] = Array.isArray(draft.itemsJson) ? draft.itemsJson : [];
    const items: Array<{
      productId: string;
      title: string;
      quantity: { count: string };
      total: string;
    }> = [];

    let itemsTotalCents = 0;

    for (let idx = 0; idx < rawItems.length; idx++) {
      const it = rawItems[idx];
      const productId = String(it?.productId ?? `item-${idx}`);
      const title = String(it?.title ?? "Товар");
      const qty = Number(it?.qty ?? it?.quantity ?? 1);
      const priceCents = Number(it?.price ?? it?.priceCents ?? 0);
      const lineTotalCents = priceCents * qty;

      itemsTotalCents += lineTotalCents;

      items.push({
        productId,
        title,
        quantity: { count: String(qty) },
        total: rub2(lineTotalCents),
      });
    }

    const discountCents =
      Number.isFinite(Number(draft.discount ?? 0)) &&
      Number(draft.discount ?? 0) > 0
        ? Number(draft.discount)
        : 0;

    if (discountCents > 0) {
      items.push({
        productId: "promo-discount",
        title: draft.promoCode
          ? `Скидка по промокоду ${draft.promoCode}`
          : "Скидка",
        quantity: { count: "1" },
        total: rub2(-discountCents),
      });
    }

    // deliveryPrice уже сохранена в draft с наценкой +10%
    const deliveryCents =
      Number.isFinite(Number(draft.deliveryPrice ?? 0)) &&
      Number(draft.deliveryPrice ?? 0) > 0
        ? Number(draft.deliveryPrice)
        : 0;

    let cartTotalCents = Math.max(itemsTotalCents - discountCents, 0);

    if (deliveryCents > 0) {
      const city = String(draft.pvzCity ?? "").trim();
      const addr = String(draft.pvzAddress ?? "").trim();
      const label =
        city || addr
          ? `Доставка СДЭК до ПВЗ (${[city, addr].filter(Boolean).join(", ")})`
          : "Доставка СДЭК до ПВЗ";

      cartTotalCents += deliveryCents;

      items.push({
        productId: "delivery",
        title: label,
        quantity: { count: "1" },
        total: rub2(deliveryCents),
      });
    }

    const expectedTotalCents = Number(draft.total || 0);
    if (expectedTotalCents !== cartTotalCents) {
      return Response.json(
        {
          error: "total mismatch",
          expectedTotalCents,
          actualTotalCents: cartTotalCents,
          itemsTotalCents,
          discountCents,
          deliveryCents,
          draftId,
        },
        { status: 400 }
      );
    }

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
        total: { amount: rub2(cartTotalCents) },
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
      return Response.json(
        { error: "Yandex Pay order create failed", details: data, payload },
        { status: 500 }
      );
    }

    const paymentUrl = data?.data?.paymentUrl;
    if (!paymentUrl) {
      return Response.json(
        { error: "paymentUrl missing in response", details: data, payload },
        { status: 500 }
      );
    }

    return Response.json({ paymentUrl });
  } catch (e: any) {
    return Response.json({ error: e?.message || "link error" }, { status: 500 });
  }
}