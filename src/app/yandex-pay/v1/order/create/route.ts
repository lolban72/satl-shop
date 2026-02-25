import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orderId = String(body?.orderId || "");

  const draft = await prisma.paymentDraft.findUnique({ where: { id: orderId } });
  if (!draft || draft.status !== "PENDING") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // ✅ Здесь ты ДОЛЖНА сверить сумму/корзину из запроса с draft,
  // зарезервировать товар (если нужно), и вернуть 200 чтобы разрешить оплату. :contentReference[oaicite:5]{index=5}

  return Response.json({ ok: true });
}