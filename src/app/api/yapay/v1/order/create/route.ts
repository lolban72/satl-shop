import { prisma } from "@/lib/prisma";

function parseAmountToCents(value: unknown) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const orderId = String(body?.orderId || "").trim();

    if (!orderId) {
      return Response.json({ error: "orderId required" }, { status: 400 });
    }

    const draft = await prisma.paymentDraft.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        total: true,
      },
    });

    if (!draft || draft.status !== "PENDING") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const amountFromBody =
      parseAmountToCents(body?.orderAmount) ??
      parseAmountToCents(body?.amount) ??
      parseAmountToCents(body?.total?.amount);

    if (amountFromBody != null && amountFromBody !== Number(draft.total)) {
      return Response.json(
        {
          error: "Amount mismatch",
          expectedTotalCents: Number(draft.total),
          actualTotalCents: amountFromBody,
        },
        { status: 400 }
      );
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "create error" },
      { status: 500 }
    );
  }
}