import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const orderId = String(body?.orderId || ""); // draftId
  const status = String(body?.status || "");  // формат статуса зависит от тела вебхука

  if (!orderId) return Response.json({ ok: true });

  if (status === "SUCCESS") {
    const draft = await prisma.paymentDraft.findUnique({ where: { id: orderId } });
    if (!draft || draft.status !== "PENDING") return Response.json({ ok: true });

    const items = Array.isArray(draft.itemsJson) ? draft.itemsJson : [];

    await prisma.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          paymentDraftId: draft.id,
          userId: draft.userId ?? null,
          status: "NEW",
          total: draft.total,
          name: draft.name,
          phone: draft.phone,
          address: draft.address,
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
      data: { status: "FAILED" },
    }).catch(() => {});
  }

  // Yandex Pay рекомендует принимать webhook 200, чтобы не ретраили бесконечно. :contentReference[oaicite:6]{index=6}
  return Response.json({ ok: true });
}