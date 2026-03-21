"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DeleteProductButton from "./ui/DeleteProductButton";

type ProductRow = {
  id: string;
  title: string;
  slug: string;
  price: number;
  sortOrder: number;
  sizeChartImage: string | null;
  categoryTitle: string;
  stock: number;
};

export default function ProductsSortManager({
  products,
}: {
  products: ProductRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [rows, setRows] = useState<ProductRow[]>(products);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const hasChanges = useMemo(() => {
    return rows.some((row, i) => row.sortOrder !== products[i]?.sortOrder);
  }, [rows, products]);

  function setSortOrder(id: string, value: string) {
    const next = Number(value);
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              sortOrder: Number.isFinite(next) ? Math.trunc(next) : 0,
            }
          : row
      )
    );
    setMessage("");
    setError("");
  }

  async function savePositions() {
    setMessage("");
    setError("");

    try {
      const changed = rows.filter(
        (row, i) => row.sortOrder !== products[i]?.sortOrder
      );

      if (changed.length === 0) {
        setMessage("Изменений нет");
        return;
      }

      for (const row of changed) {
        const formData = new URLSearchParams();
        formData.set("_method", "PATCH");
        formData.set("sortOrder", String(row.sortOrder));

        const res = await fetch(`/api/admin/products/${row.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        });

        if (!res.ok) {
          let text = "Не удалось сохранить позиции";
          try {
            const data = await res.json();
            text = data?.error || text;
          } catch {}
          throw new Error(text);
        }
      }

      setMessage("Позиции успешно сохранены");

      startTransition(() => {
        router.refresh();
      });
    } catch (e: any) {
      setError(e?.message || "Ошибка при сохранении");
    }
  }

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Товары</div>
          <div className="text-sm text-gray-600">
            Список всех товаров. Чем меньше порядок, тем выше товар на главной.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={savePositions}
            disabled={isPending}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {isPending ? "Сохранение..." : "Сохранить позиции"}
          </button>

          <Link
            href="/admin/products/new"
            className="rounded-xl bg-black px-4 py-2 text-sm text-white"
          >
            + Добавить
          </Link>
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {products.length === 0 ? (
        <p className="mt-4 text-gray-600">Товаров пока нет.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((p) => {
            return (
              <div key={p.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{p.title}</div>
                    <div className="mt-1 text-xs text-gray-600">
                      Категория: {p.categoryTitle}
                    </div>

                    <div className="mt-2 text-sm text-gray-600">
                      Порядок на главной:{" "}
                      <span className="font-semibold text-black">
                        {p.sortOrder}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-semibold">
                      {(p.price / 100).toFixed(2)}р
                    </div>
                    <div className="text-sm text-gray-600">Осталось: {p.stock}</div>

                    <div className="mt-3 flex items-center justify-end gap-2">
                      <input
                        type="number"
                        value={p.sortOrder}
                        onChange={(e) => setSortOrder(p.id, e.target.value)}
                        className="h-9 w-24 rounded-xl border px-3 text-sm"
                        placeholder="Порядок"
                      />
                    </div>

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