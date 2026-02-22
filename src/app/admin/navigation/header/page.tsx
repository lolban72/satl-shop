"use client";

import { useEffect, useMemo, useState } from "react";

type Category = {
  id: string;
  title: string;
  slug: string;
  showInNav: boolean;
  navOrder: number;
};

export default function HeaderNavOrderPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => (a.navOrder ?? 0) - (b.navOrder ?? 0) || a.title.localeCompare(b.title));
  }, [items]);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Не удалось загрузить категории");

      const list = (Array.isArray(data) ? data : []) as any[];
      setItems(
        list
          .map((c) => ({
            id: c.id,
            title: c.title,
            slug: c.slug,
            showInNav: Boolean(c.showInNav),
            navOrder: Number(c.navOrder ?? 0),
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
    if (!res.ok) throw new Error(data?.error || "Не удалось сохранить");
  }

  async function move(index: number, dir: -1 | 1) {
    const arr = sorted;
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;

    // меняем местами navOrder
    const a = arr[index];
    const b = arr[j];

    const next = items.map((it) => {
      if (it.id === a.id) return { ...it, navOrder: b.navOrder };
      if (it.id === b.id) return { ...it, navOrder: a.navOrder };
      return it;
    });
    setItems(next);

    setSaving(true);
    setErr(null);
    try {
      await Promise.all([
        patch(a.id, { navOrder: b.navOrder }),
        patch(b.id, { navOrder: a.navOrder }),
      ]);
    } catch (e: any) {
      setErr(e?.message || "Ошибка сохранения");
      // если хочешь — можно reload() для отката
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Порядок категорий в шапке</div>
          <div className="mt-1 text-sm text-gray-600">
            Здесь меняется только порядок (navOrder). Показываются категории с showInNav=true.
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

      {err ? (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm">{err}</div>
      ) : null}

      <div className="mt-4 text-sm text-gray-600">
        {saving ? "Сохраняю изменения..." : " "}
      </div>

      <div className="mt-3 space-y-2">
        {sorted
          .filter((c) => c.showInNav)
          .map((c, idx, arr) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0">
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-gray-600">slug: {c.slug} · navOrder: {c.navOrder}</div>
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
