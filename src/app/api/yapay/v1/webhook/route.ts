import { prisma } from "@/lib/prisma";

function b64urlDecodeToString(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  return Buffer.from(s, "base64").toString("utf8");
}

export async function POST(req: Request) {
  try {
    const jwt = (await req.text()).trim();
    const parts = jwt.split(".");
    if (parts.length !== 3) return Response.json({ ok: true });

    const payloadStr = b64urlDecodeToString(parts[1]);
    const payload = JSON.parse(payloadStr);

    const orderId = String(payload?.order?.orderId || "");
    const paymentStatus = String(payload?.order?.paymentStatus || "");

    if (!orderId) return Response.json({ ok: true });

    if (paymentStatus === "CAPTURED") {
      const draft = await prisma.paymentDraft.findUnique({
        where: { id: orderId },
      });

      if (!draft) return Response.json({ ok: true });

      await prisma.paymentDraft.update({
        where: { id: orderId },
        data: { status: "PAID" },
      });

      // ✅ Проверяем, не создан ли уже заказ
      const existing = await prisma.order.findUnique({
        where: { paymentDraftId: orderId },
      });

      if (!existing) {
        await prisma.order.create({
          data: {
            paymentDraftId: orderId,
            name: draft.customerName,
            phone: draft.customerPhone,
            address: draft.customerAddress,
            total: draft.totalCents,
            status: "NEW",
            items: {
              create: draft.itemsJson.map((it: any) => ({
                productId: it.productId,
                variantId: it.variantId,
                quantity: it.qty,
                price: it.price,
                title: it.title,
              })),
            },
          },
        });

        console.log("✅ Order created from draft:", orderId);
      }
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    console.log("❌ YAPAY WEBHOOK ERROR:", e?.message || e);
    return Response.json({ ok: true });
  }
}