import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orderId = String(body?.orderId || ""); // = draftId

  const draft = await prisma.paymentDraft.findUnique({ where: { id: orderId } });
  if (!draft || draft.status !== "PENDING") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const items = Array.isArray(draft.itemsJson) ? draft.itemsJson : [];

  // Минимально возвращаем корзину и сумму
  return Response.json({
    orderId: draft.id,
    currencyCode: "RUB",
    availablePaymentMethods: ["CARD"],

    cart: {
      total: { amount: (draft.total / 100).toFixed(2) },
      items: items.map((it: any, idx: number) => ({
        productId: String(it.productId ?? `p${idx}`),
        title: String(it.title ?? "Товар"),
        quantity: { count: Number(it.qty) || 1 },
        total: ((Number(it.price) || 0) * (Number(it.qty) || 1) / 100).toFixed(2),
      })),
    },
  });
}