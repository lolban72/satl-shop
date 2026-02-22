import { prisma } from "@/lib/prisma";

export async function POST() {
  // чтобы сид не дублировал данные
  const exists = await prisma.product.findUnique({ where: { slug: "tshirt-black" } });
  if (exists) return Response.json({ ok: true, message: "Already seeded" });

  await prisma.product.create({
    data: {
      slug: "tshirt-black",
      title: "Футболка Black",
      description: "Базовая хлопковая футболка",
      price: 199900,
      images: ["https://picsum.photos/seed/tshirt-black/800/800"],
      variants: {
        create: [
          { size: "S", color: "Black", sku: "TSH-BLK-S", stock: 10 },
          { size: "M", color: "Black", sku: "TSH-BLK-M", stock: 8 },
          { size: "L", color: "Black", sku: "TSH-BLK-L", stock: 6 },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      slug: "hoodie-gray",
      title: "Худи Gray",
      description: "Тёплое худи оверсайз",
      price: 399900,
      images: ["https://picsum.photos/seed/hoodie-gray/800/800"],
      variants: {
        create: [
          { size: "M", color: "Gray", sku: "HD-GRY-M", stock: 5 },
          { size: "L", color: "Gray", sku: "HD-GRY-L", stock: 3 },
        ],
      },
    },
  });

  return Response.json({ ok: true });
}
