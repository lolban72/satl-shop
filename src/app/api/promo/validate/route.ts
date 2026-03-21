import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { code, orderTotal } = await req.json();

  if (!code) {
    return Response.json({ error: "Promo code required" }, { status: 400 });
  }

  const promo = await prisma.promoCode.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!promo || !promo.isActive) {
    return Response.json({ error: "Promo code invalid" }, { status: 400 });
  }

  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return Response.json({ error: "Promo expired" }, { status: 400 });
  }

  if (promo.maxUses && promo.usedCount >= promo.maxUses) {
    return Response.json({ error: "Promo usage limit reached" }, { status: 400 });
  }

  if (promo.minOrderTotal && orderTotal < promo.minOrderTotal) {
    return Response.json({
      error: "Order total too small",
    }, { status: 400 });
  }

  let discount = 0;

  if (promo.discountType === "percent") {
    discount = Math.round(orderTotal * promo.discountValue / 100);
  }

  if (promo.discountType === "fixed") {
    discount = promo.discountValue;
  }

  return Response.json({
    success: true,
    discount,
    promoId: promo.id,
  });
}