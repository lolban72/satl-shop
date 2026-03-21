import { prisma } from "@/lib/prisma";
import ProductsSortManager from "./ProductsSortManager";

export const metadata = {
  title: "Товары | SATL-админ",
};

export default async function ProductsListPage() {
  const products = await prisma.product.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { variants: true, category: true },
  });

  const preparedProducts = products.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    price: p.price,
    sortOrder: p.sortOrder ?? 0,
    sizeChartImage: p.sizeChartImage,
    categoryTitle: p.category?.title ?? "—",
    stock: p.variants.reduce((s, v) => s + v.stock, 0),
  }));

  return <ProductsSortManager products={preparedProducts} />;
}