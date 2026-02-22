"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; // ✅ ДОБАВЬ

export default function MarqueeForm() {
  const router = useRouter(); // ✅ ДОБАВЬ

  const [text, setText] = useState("");
  const [speedSeconds, setSpeedSeconds] = useState("10");
  const [enabled, setEnabled] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/marquee", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Не удалось загрузить");

        setText(data.text ?? "");
        setSpeedSeconds(String(data.speedSeconds ?? 10));
        setEnabled(Boolean(data.enabled));
      } catch (e: any) {
        setErr(e?.message || "Ошибка");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/marquee", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speedSeconds, enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Не удалось сохранить");

      setOk("Сохранено ✅");
      router.refresh(); // ✅ ВОТ ЭТО КЛЮЧЕВО
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="mt-4 text-sm text-gray-600">Загрузка...</div>;

  return (
    <div className="mt-4 grid gap-3">
      {err && <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm">{err}</div>}
      {ok && <div className="rounded-xl border border-green-300 bg-green-50 p-3 text-sm">{ok}</div>}

      <label className="grid gap-1">
        <span className="text-sm font-medium">Текст</span>
        <input
          className="rounded-xl border p-2"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="СКИДКИ 20%"
        />
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Скорость (сек)</span>
        <input
          className="rounded-xl border p-2"
          value={speedSeconds}
          onChange={(e) => setSpeedSeconds(e.target.value)}
          inputMode="numeric"
        />
        <div className="text-xs text-gray-600">Минимум 5 сек.</div>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Включено
      </label>

      <button
        className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
        disabled={saving}
        onClick={save}
      >
        {saving ? "Сохраняю..." : "Сохранить"}
      </button>
      <div className="text-xs text-gray-600">Нажми 2 раза на кнопку, чтобы сохранить</div>
    </div>
  );
}
