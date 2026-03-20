import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DeleteProductButton from "./ui/DeleteProductButton";

export const metadata = {
  title: "Товары | SATL-админ",
};

export default async function ProductsListPage() {
  const products = await prisma.product.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { variants: true, category: true },
  });

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Товары</div>
          <div className="text-sm text-gray-600">
            Список всех товаров. Чем меньше порядок, тем выше товар на главной.
          </div>
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

                    <div className="mt-2 text-sm text-gray-600">
                      Порядок на главной: <span className="font-semibold text-black">{p.sortOrder ?? 0}</span>
                    </div>

                    {p.sizeChartImage && (
                      <div className="mt-2">
                        <span className="text-sm text-gray-600">Таблица размеров:</span>
                        <a
                          href={p.sizeChartImage}
                          target="_blank"
                          className="ml-2 text-sm text-blue-500 underline"
                        >
                          Скачать
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="font-semibold">{(p.price / 100).toFixed(2)}р</div>
                    <div className="text-sm text-gray-600">stock: {stock}</div>

                    <form
                      action={`/api/admin/products/${p.id}`}
                      method="POST"
                      className="mt-3 flex items-center justify-end gap-2"
                    >
                      <input type="hidden" name="_method" value="PATCH" />
                      <input
                        type="number"
                        name="sortOrder"
                        defaultValue={p.sortOrder ?? 0}
                        className="h-9 w-24 rounded-xl border px-3 text-sm"
                        placeholder="Порядок"
                      />
                      <button
                        type="submit"
                        className="h-9 rounded-xl border px-3 text-sm hover:bg-gray-50"
                      >
                        Сохранить
                      </button>
                    </form>

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