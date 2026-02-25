// src/app/api/yapay/v1/order/render/route.ts
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orderId = String(body?.orderId || ""); // draftId

  const draft = await prisma.paymentDraft.findUnique({
    where: { id: orderId },
  });

  if (!draft || draft.status !== "PENDING") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const items = Array.isArray(draft.itemsJson) ? draft.itemsJson : [];

  // минимальный ответ: сумма + товары
  return Response.json({
    orderId: draft.id,
    currencyCode: "RUB",
    total: { amount: (draft.total / 100).toFixed(2) },
    items: items.map((it: any) => ({
      label: String(it.title ?? "Товар"),
      amount: ((Number(it.price) || 0) / 100).toFixed(2),
      quantity: Number(it.qty) || 1,
    })),
  });
}