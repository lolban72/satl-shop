import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import LabelClient from "./LabelClient";

export default async function LabelPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true }, // только items (без variant include)
  });

  if (!order) notFound();

  // ✅ подтягиваем variant для каждого item вручную
  const variantIds = Array.from(
    new Set(order.items.map((it) => it.variantId).filter(Boolean) as string[])
  );

  const variants = await prisma.variant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, size: true, color: true },
  });

  const vmap = new Map(variants.map((v) => [v.id, v]));

  const orderWithVariant = {
    ...order,
    items: order.items.map((it) => ({
      ...it,
      variant: it.variantId ? vmap.get(it.variantId) ?? null : null,
    })),
  };

  return <LabelClient order={orderWithVariant} />;
}