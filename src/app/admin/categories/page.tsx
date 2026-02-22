"use client";

import { useEffect, useState } from "react";

type Category = {
  id: string;
  title: string;
  slug: string;
  showInNav: boolean;
  showOnHome: boolean;
  navOrder: number;
  homeOrder: number;
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminCategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // create
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Не удалось загрузить категории");
      setItems(data);
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setErr(null);
    const t = title.trim();
    if (t.length < 2) return setErr("Название слишком короткое");

    const s = (slug.trim() || slugify(t));
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        slug: s,
        navOrder: 0,
        homeOrder: 0,
        showInNav: true,
        showOnHome: true,
      }),
    });

    const data = await res.json();
    if (!res.ok) return setErr(data?.error || "Не удалось создать");

    setTitle("");
    setSlug("");
    await load();
  }

  async function patch(id: string, body: Partial<Category>) {
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Не удалось обновить");
  }

  async function remove(id: string) {
    if (!confirm("Удалить категорию?")) return;
    const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setErr(data?.error || "Не удалось удалить");
    await load();
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border p-4">
        <div className="text-lg font-semibold">Категории</div>
        <div className="mt-1 text-sm text-gray-600">Добавление/изменение/удаление категорий.</div>

        {err ? <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm">{err}</div> : null}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input className="rounded-xl border p-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название" />
          <input className="rounded-xl border p-2" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug (необязательно)" />
          <button className="rounded-xl bg-black px-4 py-2 text-white" onClick={create}>
            + Добавить
          </button>
        </div>
      </div>

      <div className="rounded-2xl border p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Список</div>
          <button className="text-sm underline" onClick={load} disabled={loading}>
            {loading ? "Обновляю..." : "Обновить"}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {items.map((c) => (
            <div key={c.id} className="rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-sm text-gray-600">{c.slug}</div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={c.showInNav}
                      onChange={async (e) => {
                        const v = e.target.checked;
                        setItems((x) => x.map((it) => (it.id === c.id ? { ...it, showInNav: v } : it)));
                        await patch(c.id, { showInNav: v });
                      }}
                    />
                    в шапке
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={c.showOnHome}
                      onChange={async (e) => {
                        const v = e.target.checked;
                        setItems((x) => x.map((it) => (it.id === c.id ? { ...it, showOnHome: v } : it)));
                        await patch(c.id, { showOnHome: v });
                      }}
                    />
                    на главной
                  </label>

                  <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => remove(c.id)}>
                    Удалить
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-gray-600">navOrder (шапка)</span>
                  <input
                    className="rounded-xl border p-2"
                    value={c.navOrder}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setItems((x) => x.map((it) => (it.id === c.id ? { ...it, navOrder: v } : it)));
                    }}
                    onBlur={async (e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) await patch(c.id, { navOrder: v });
                    }}
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-gray-600">homeOrder (главная)</span>
                  <input
                    className="rounded-xl border p-2"
                    value={c.homeOrder}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setItems((x) => x.map((it) => (it.id === c.id ? { ...it, homeOrder: v } : it)));
                    }}
                    onBlur={async (e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) await patch(c.id, { homeOrder: v });
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
