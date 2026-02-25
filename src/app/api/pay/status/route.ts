import { prisma } from "@/lib/prisma";

function toAmount(totalCents: number) {
  // Яндекс Пэй обычно ждёт строку с рублями и 2 знаками после запятой
  // (если понадобится 0 знаков — поменяем)
  return (Number(totalCents || 0) / 100).toFixed(2);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const draftId = String(searchParams.get("draftId") || "").trim();

  if (!draftId) {
    return Response.json({ error: "draftId required" }, { status: 400 });
  }

  const draft = await prisma.paymentDraft.findUnique({
    where: { id: draftId },
    select: { status: true, total: true },
  });

  if (!draft) {
    return Response.json({ status: "NOT_FOUND" }, { status: 404 });
  }

  return Response.json({
    status: draft.status,
    totalCents: draft.total,
    totalAmount: toAmount(draft.total),
  });
}