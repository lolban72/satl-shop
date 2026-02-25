// src/app/api/yapay/v1/order/create/route.ts
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orderId = String(body?.orderId || "");

  const draft = await prisma.paymentDraft.findUnique({ where: { id: orderId } });
  if (!draft || draft.status !== "PENDING") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // TODO: сверка суммы из body с draft.total, резервирование и инициирование оплаты у PSP

  // Если всё ок — 200
  return Response.json({ ok: true });
}