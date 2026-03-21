import { prisma } from "@/lib/prisma";

function toAmount(totalCents: number) {
  return (Number(totalCents || 0) / 100).toFixed(2);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const draftId = String(searchParams.get("draftId") || "").trim();

    if (!draftId) {
      return Response.json({ error: "draftId required" }, { status: 400 });
    }

    const draft = await prisma.paymentDraft.findUnique({
      where: { id: draftId },
      select: {
        status: true,
        total: true,
      },
    });

    if (!draft) {
      return Response.json({ status: "NOT_FOUND" }, { status: 404 });
    }

    const order = await prisma.order.findUnique({
      where: { paymentDraftId: draftId },
      select: { id: true, status: true },
    });

    return Response.json({
      status: draft.status,
      totalCents: draft.total,
      totalAmount: toAmount(draft.total),
      orderId: order?.id ?? null,
      orderStatus: order?.status ?? null,
      confirmed: draft.status === "PAID" && !!order?.id,
    });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "status error" },
      { status: 500 }
    );
  }
}