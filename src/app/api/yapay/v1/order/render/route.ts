import { prisma } from "@/lib/prisma";

function toAmount(totalCents: number) {
  return (Number(totalCents || 0) / 100).toFixed(2);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const orderId = String(body?.orderId || "").trim();

    if (!orderId) {
      return Response.json({ error: "orderId required" }, { status: 400 });
    }

    const draft = await prisma.paymentDraft.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        total: true,
        itemsJson: true,
        deliveryPrice: true,
        pvzCity: true,
        pvzAddress: true,
      },
    });

    if (!draft || draft.status !== "PENDING") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const rawItems = Array.isArray(draft.itemsJson) ? draft.itemsJson : [];

    const items = rawItems.map((it: any) => ({
      label: String(it?.title ?? "Товар"),
      amount: toAmount(Number(it?.price ?? it?.priceCents ?? 0)),
      quantity: Number(it?.qty ?? it?.quantity ?? 1),
    }));

    const deliveryCents = Number(draft.deliveryPrice ?? 0);
    if (deliveryCents > 0) {
      const city = String(draft.pvzCity ?? "").trim();
      const addr = String(draft.pvzAddress ?? "").trim();
      const label =
        city || addr
          ? `Доставка СДЭК до ПВЗ (${[city, addr].filter(Boolean).join(", ")})`
          : "Доставка СДЭК до ПВЗ";

      items.push({
        label,
        amount: toAmount(deliveryCents),
        quantity: 1,
      });
    }

    return Response.json({
      orderId: draft.id,
      currencyCode: "RUB",
      total: { amount: toAmount(draft.total) },
      items,
    });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "render error" },
      { status: 500 }
    );
  }
}