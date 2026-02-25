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

    console.log("✅ YAPAY WEBHOOK HIT");
    console.log("headers:", Object.fromEntries(req.headers.entries()));
    console.log("raw body:", jwt);

    const parts = jwt.split(".");
    if (parts.length !== 3) {
      console.log("❌ Bad JWT format");
      return Response.json({ ok: true });
    }

    const payloadStr = b64urlDecodeToString(parts[1]);
    const payload = JSON.parse(payloadStr);

    const orderId = String(payload?.order?.orderId || "");
    const paymentStatus = String(payload?.order?.paymentStatus || "");

    console.log("✅ YAPAY PAYLOAD:", { orderId, paymentStatus });

    if (!orderId) return Response.json({ ok: true });

    // интересует только успешная оплата
    if (paymentStatus !== "CAPTURED") return Response.json({ ok: true });

    // берём draft
    const draft = await prisma.paymentDraft.findUnique({
      where: { id: orderId },
    });

    if (!draft) {
      console.log("❌ PaymentDraft not found:", orderId);
      return Response.json({ ok: true });
    }

    // ✅ идемпотентность: если заказ уже создан — просто ставим PAID и выходим
    const existing = await prisma.order.findUnique({
      where: { paymentDraftId: orderId },
      select: { id: true },
    });

    if (existing) {
      await prisma.paymentDraft.update({
        where: { id: orderId },
        data: { status: "PAID" },
      });

      console.log("ℹ️ Order already exists:", existing.id);
      return Response.json({ ok: true });
    }

    // ставим PAID
    await prisma.paymentDraft.update({
      where: { id: orderId },
      data: { status: "PAID" },
    });

    // itemsJson у тебя Json => это массив объектов
    const items: any[] = Array.isArray(draft.itemsJson) ? (draft.itemsJson as any[]) : [];

    // создаём заказ
    const created = await prisma.order.create({
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
            title: String(it.title ?? ""),
            price: Number(it.price ?? 0),
            quantity: Number(it.qty ?? it.quantity ?? 1),
          })),
        },
      },
      select: { id: true },
    });

    console.log("✅ Order created:", created.id, "from draft:", orderId);

    return Response.json({ ok: true });
  } catch (e: any) {
    console.log("❌ YAPAY WEBHOOK ERROR:", e?.message || e);
    return Response.json({ ok: true });
  }
}