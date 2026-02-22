"use client";

import { useEffect, useMemo, useState } from "react";

type Category = {
  id: string;
  title: string;
  slug: string;
  showOnHome: boolean;
  homeOrder: number;
};

export default function HomeCategoriesOrderPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...items].sort(
      (a, b) =>
        (a.homeOrder ?? 0) - (b.homeOrder ?? 0) ||
        a.title.localeCompare(b.title)
    );
  }, [items]);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error || "Не удалось загрузить категории");

      const list = (Array.isArray(data) ? data : []) as any[];

      setItems(
        list.map((c) => ({
          id: c.id,
          title: c.title,
          slug: c.slug,
          showOnHome: Boolean(c.showOnHome),
          homeOrder: Number(c.homeOrder ?? 0),
        }))
      );
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, body: Partial<Category>) {
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data?.error || "Не удалось сохранить");
  }

  async function move(index: number, dir: -1 | 1) {
    const arr = sorted.filter((c) => c.showOnHome);
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;

    const a = arr[index];
    const b = arr[j];

    const next = items.map((it) => {
      if (it.id === a.id) return { ...it, homeOrder: b.homeOrder };
      if (it.id === b.id) return { ...it, homeOrder: a.homeOrder };
      return it;
    });

    setItems(next);

    setSaving(true);
    setErr(null);
    try {
      await Promise.all([
        patch(a.id, { homeOrder: b.homeOrder }),
        patch(b.id, { homeOrder: a.homeOrder }),
      ]);
    } catch (e: any) {
      setErr(e?.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">
            Порядок категорий на главной
          </div>
          <div className="mt-1 text-sm text-gray-600">
            Меняется поле homeOrder. Показываются категории с showOnHome=true.
          </div>
        </div>

        <button
          className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Обновляю..." : "Обновить"}
        </button>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm">
          {err}
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600">
        {saving ? "Сохраняю изменения..." : " "}
      </div>

      <div className="mt-3 space-y-2">
        {sorted
          .filter((c) => c.showOnHome)
          .map((c, idx, arr) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div className="min-w-0">
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-gray-600">
                  slug: {c.slug} · homeOrder: {c.homeOrder}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                  disabled={saving || idx === 0}
                  onClick={() => move(idx, -1)}
                >
                  ↑
                </button>
                <button
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                  disabled={saving || idx === arr.length - 1}
                  onClick={() => move(idx, 1)}
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
