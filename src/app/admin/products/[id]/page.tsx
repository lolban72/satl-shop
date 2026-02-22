import { prisma } from "@/lib/prisma";
import ProductEditForm from "../ui/ProductEditForm";

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    }),
    prisma.category.findMany({
      orderBy: [{ title: "asc" }],
      select: { id: true, title: true, slug: true },
    }),
  ]);

  if (!product) return <div className="p-6">Товар не найден</div>;

  const stock = product.variants.reduce((s, v) => s + v.stock, 0);

  return (
    <div className="rounded-2xl border p-4">
      <div className="text-lg font-semibold">Редактирование товара</div>
      <div className="mt-1 text-sm text-gray-600 break-all">
        /product/{product.slug}
      </div>

      <ProductEditForm
        product={{
          id: product.id,
          title: product.title,
          slug: product.slug,
          price: product.price,
          description: product.description ?? "",

          // ✅ обложка (первое фото)
          homeImage: product.images?.[0] ?? null,

          // ✅ галерея (всё кроме первого)
          galleryImages: product.images?.slice(1) ?? [],

          // ✅ NEW: размерная таблица (картинка)
          sizeChartImage: product.sizeChartImage ?? null,

          // ✅ варианты
          variants: product.variants.map((v) => ({
            id: v.id,
            size: v.size,
            color: v.color,
            stock: v.stock,
          })),

          // оставляю для совместимости, если где-то ещё используется

          categoryId: product.categoryId ?? null,
          isSoon: product.isSoon,
          discountPercent: product.discountPercent ?? 0,
        }}
        categories={categories}
      />
    </div>
  );
}
