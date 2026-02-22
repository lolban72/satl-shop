import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DeleteProductButton from "./ui/DeleteProductButton";

export default async function ProductsListPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: { variants: true, category: true },
  });

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Товары</div>
          <div className="text-sm text-gray-600">Список всех товаров.</div>
        </div>
        <Link href="/admin/products/new" className="rounded-xl bg-black px-4 py-2 text-sm text-white">
          + Добавить
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="mt-4 text-gray-600">Товаров пока нет.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {products.map((p) => {
            const stock = p.variants.reduce((s, v) => s + v.stock, 0);
            return (
              <div key={p.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-sm text-gray-600 break-all">/product/{p.slug}</div>
                    <div className="mt-1 text-xs text-gray-600">
                      Категория: {p.category?.title ?? "—"}
                    </div>
                    {/* Display the size chart image if it exists */}
                    {p.sizeChartImage && (
                      <div className="mt-2">
                        <span className="text-sm text-gray-600">Таблица размеров:</span>
                        <a href={p.sizeChartImage} target="_blank" className="text-sm text-blue-500 underline ml-2">
                          Скачать
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="font-semibold">{(p.price / 100).toFixed(2)}р</div>
                    <div className="text-sm text-gray-600">stock: {stock}</div>

                    <Link
                      href={`/admin/products/${p.id}`}
                      className="mt-2 inline-block text-sm underline"
                    >
                      Редактировать
                    </Link>

                    <DeleteProductButton id={p.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
