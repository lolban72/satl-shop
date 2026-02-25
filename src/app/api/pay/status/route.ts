import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const draftId = String(searchParams.get("draftId") || "");

  if (!draftId) return Response.json({ error: "draftId required" }, { status: 400 });

  const draft = await prisma.paymentDraft.findUnique({
    where: { id: draftId },
    select: { status: true },
  });

  if (!draft) return Response.json({ status: "NOT_FOUND" });

  return Response.json({ status: draft.status });
}