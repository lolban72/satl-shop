// src/app/api/yapay/v1/webhook/route.ts
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const orderId = String(body?.orderId || "");
  const status = String(body?.status || ""); // например SUCCESS/FAILED — зависит от формата, см. доки

  if (!orderId) return Response.json({ ok: true });

  if (status === "SUCCESS") {
    const draft = await prisma.paymentDraft.findUnique({ where: { id: orderId } });
    if (!draft || draft.status !== "PENDING") return Response.json({ ok: true });

    const items = Array.isArray(draft.itemsJson) ? draft.itemsJson : [];
    const total = draft.total;

    await prisma.$transaction(async (tx) => {
      // создаём заказ
      await tx.order.create({
        data: {
          status: "NEW",
          total,
          name: draft.name,
          phone: draft.phone,
          address: draft.address,
          // userId опционально, если есть логика пользователя — можно проставить
          items: {
            create: items.map((it: any) => ({
              productId: String(it.productId),
              variantId: it.variantId ? String(it.variantId) : null,
              title: String(it.title),
              price: Number(it.price) || 0,
              quantity: Number(it.qty) || 1,
            })),
          },
        },
      });

      await tx.paymentDraft.update({
        where: { id: draft.id },
        data: { status: "PAID" },
      });
    });
  } else if (status === "FAILED") {
    await prisma.paymentDraft.update({
      where: { id: orderId },
      data: { status: "CANCELED" },
    }).catch(() => {});
  }

  return Response.json({ ok: true });
}