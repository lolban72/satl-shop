import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Bad request" }, { status: 400 });

  const name = String(body?.name ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const address = String(body?.address ?? "").trim();
  const email = body?.email ? String(body.email).trim().toLowerCase() : null;

  const items = Array.isArray(body?.items) ? body.items : [];
  if (!name || !phone || !address || items.length === 0) {
    return Response.json({ error: "Заполните данные и корзину" }, { status: 400 });
  }

  // items: [{ productId, variantId?, title, price, qty }]
  const total = items.reduce((s: number, it: any) => {
    const price = Number(it?.price) || 0; // в копейках
    const qty = Number(it?.qty) || 0;
    return s + price * qty;
  }, 0);

  if (total <= 0) {
    return Response.json({ error: "Некорректная сумма" }, { status: 400 });
  }

  const draft = await prisma.paymentDraft.create({
    data: {
      userId: userId ?? null,
      email,
      name,
      phone,
      address,
      itemsJson: items,
      total,
    },
    select: { id: true },
  });

  return Response.json({ draftId: draft.id });
}