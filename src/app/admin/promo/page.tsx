"use client";

import { useEffect, useState } from "react";

type Promo = {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minOrderTotal: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
};

function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";
  return `${(value / 100).toFixed(0)} ₽`;
}

function formatDiscount(promo: Promo) {
  if (promo.discountType === "percent") {
    return `${promo.discountValue}%`;
  }
  return formatMoney(promo.discountValue);
}

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

export default function AdminPromoPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderTotal, setMinOrderTotal] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function loadPromos() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/admin/promo", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Не удалось загрузить промокоды");
      }

      setPromos(Array.isArray(data.promos) ? data.promos : []);
    } catch (e: any) {
      setError(e?.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPromos();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      const payload = {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        minOrderTotal: minOrderTotal.trim() ? Number(minOrderTotal) * 100 : null,
        maxUses: maxUses.trim() ? Number(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        isActive,
      };

      const res = await fetch("/api/admin/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Не удалось создать промокод");
      }

      setCode("");
      setDiscountType("percent");
      setDiscountValue("");
      setMinOrderTotal("");
      setMaxUses("");
      setExpiresAt("");
      setIsActive(true);

      await loadPromos();
    } catch (e: any) {
      setError(e?.message || "Ошибка создания");
    } finally {
      setSaving(false);
    }
  }

  async function togglePromo(id: string, nextValue: boolean) {
    try {
      setError("");

      const res = await fetch(`/api/admin/promo/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextValue }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Не удалось обновить промокод");
      }

      setPromos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isActive: data.promo.isActive } : p))
      );
    } catch (e: any) {
      setError(e?.message || "Ошибка обновления");
    }
  }

  async function removePromo(id: string) {
    const ok = window.confirm("Удалить промокод?");
    if (!ok) return;

    try {
      setError("");

      const res = await fetch(`/api/admin/promo/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Не удалось удалить промокод");
      }

      setPromos((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      setError(e?.message || "Ошибка удаления");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Промокоды</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Создание и управление промокодами магазина
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-8 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-medium">Создать промокод</h2>

        <form onSubmit={onCreate} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <div className="mb-1 text-sm font-medium">Код</div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WELCOME10"
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
              required
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-medium">Тип скидки</div>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
            >
              <option value="percent">Процент</option>
              <option value="fixed">Фиксированная</option>
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-medium">
              {discountType === "percent" ? "Скидка (%)" : "Скидка (₽)"}
            </div>
            <input
              type="number"
              min={1}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === "percent" ? "10" : "500"}
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
              required
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-medium">Мин. сумма заказа (₽)</div>
            <input
              type="number"
              min={0}
              value={minOrderTotal}
              onChange={(e) => setMinOrderTotal(e.target.value)}
              placeholder="3000"
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-medium">Макс. использований</div>
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="100"
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-medium">Срок действия</div>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={toDatetimeLocalValue(new Date())}
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
            />
          </label>

          <label className="flex items-end">
            <span className="flex items-center gap-3 rounded-xl border px-3 py-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span className="text-sm font-medium">Сразу активировать</span>
            </span>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-black px-4 py-2 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Создание..." : "Создать промокод"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-medium">Все промокоды</h2>
        </div>

        {loading ? (
          <div className="p-5 text-sm text-neutral-500">Загрузка...</div>
        ) : promos.length === 0 ? (
          <div className="p-5 text-sm text-neutral-500">Промокодов пока нет</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-neutral-50 text-left">
                  <th className="px-4 py-3 font-medium">Код</th>
                  <th className="px-4 py-3 font-medium">Скидка</th>
                  <th className="px-4 py-3 font-medium">Мин. заказ</th>
                  <th className="px-4 py-3 font-medium">Использовано</th>
                  <th className="px-4 py-3 font-medium">Срок</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {promos.map((promo) => {
                  const expired =
                    promo.expiresAt ? new Date(promo.expiresAt).getTime() < Date.now() : false;

                  return (
                    <tr key={promo.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium">{promo.code}</td>
                      <td className="px-4 py-3">{formatDiscount(promo)}</td>
                      <td className="px-4 py-3">{formatMoney(promo.minOrderTotal)}</td>
                      <td className="px-4 py-3">
                        {promo.usedCount}
                        {promo.maxUses ? ` / ${promo.maxUses}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        {promo.expiresAt
                          ? new Date(promo.expiresAt).toLocaleString("ru-RU")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            promo.isActive && !expired
                              ? "bg-green-100 text-green-700"
                              : "bg-neutral-200 text-neutral-700"
                          }`}
                        >
                          {expired ? "Истёк" : promo.isActive ? "Активен" : "Выключен"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => togglePromo(promo.id, !promo.isActive)}
                            className="rounded-lg border px-3 py-1.5 hover:bg-neutral-50"
                          >
                            {promo.isActive ? "Выключить" : "Включить"}
                          </button>

                          <button
                            onClick={() => removePromo(promo.id)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-red-600 hover:bg-red-50"
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}