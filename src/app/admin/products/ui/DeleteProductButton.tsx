"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteProductButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function remove() {
    if (!confirm("Удалить товар? Это действие нельзя отменить.")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка удаления");

      router.refresh();
    } catch (e: any) {
      alert(e?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={remove}
      disabled={loading}
      className="mt-2 inline-block rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
    >
      {loading ? "Удаляю..." : "Удалить"}
    </button>
  );
}
