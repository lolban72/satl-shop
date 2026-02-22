"use client";

import { useEffect, useState } from "react";

type Banner = {
  enabled: boolean;
  title?: string | null;
  subtitle?: string | null;
  buttonText?: string | null;
  buttonHref?: string | null;
  imageDesktop?: string | null;
  imageMobile?: string | null;
  overlay: number;
};

function trim(v: any) {
  return String(v ?? "").trim();
}

function toNull(v: any) {
  const s = trim(v);
  return s.length ? s : null;
}

export default function HeroBannerEditor() {
  const [b, setB] = useState<Banner | null>(null);

  const [fileDesktop, setFileDesktop] = useState<File | null>(null);
  const [fileMobile, setFileMobile] = useState<File | null>(null);

  const [previewDesktop, setPreviewDesktop] = useState<string>("");
  const [previewMobile, setPreviewMobile] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    setErr(null);
    const res = await fetch("/api/admin/hero", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      setErr(data?.error || "Не удалось загрузить");
      return;
    }
    setB(data);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!fileDesktop) {
      setPreviewDesktop("");
      return;
    }
    const url = URL.createObjectURL(fileDesktop);
    setPreviewDesktop(url);
    return () => URL.revokeObjectURL(url);
  }, [fileDesktop]);

  useEffect(() => {
    if (!fileMobile) {
      setPreviewMobile("");
      return;
    }
    const url = URL.createObjectURL(fileMobile);
    setPreviewMobile(url);
    return () => URL.revokeObjectURL(url);
  }, [fileMobile]);

  async function upload(file: File): Promise<string> {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Не удалось загрузить фото");
      return String(data.url || "");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!b) return;

    setErr(null);
    setOk(null);
    setSaving(true);

    try {
      // ✅ title теперь НЕ обязателен: может быть ""
      const title = trim(b.title); // отправим строкой, даже если пусто

      let imageDesktop = toNull(b.imageDesktop);
      let imageMobile = toNull(b.imageMobile);

      if (fileDesktop) {
        const url = await upload(fileDesktop);
        imageDesktop = url || null;
      }
      if (fileMobile) {
        const url = await upload(fileMobile);
        imageMobile = url || null;
      }

      const payload = {
        enabled: !!b.enabled,
        title, // ✅ может быть ""
        subtitle: toNull(b.subtitle),
        buttonText: toNull(b.buttonText),
        buttonHref: toNull(b.buttonHref),
        imageDesktop,
        imageMobile,
        overlay: Number.isFinite(Number(b.overlay)) ? Number(b.overlay) : 25,
      };

      const res = await fetch("/api/admin/hero", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Не удалось сохранить");

      setB(data);
      setFileDesktop(null);
      setFileMobile(null);
      setOk("Сохранено ✅");
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  if (!b) return <div className="text-sm text-gray-600">Загрузка...</div>;

  return (
    <div className="grid gap-3">
      {err && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm">
          {err}
        </div>
      )}
      {ok && (
        <div className="rounded-xl border border-green-300 bg-green-50 p-3 text-sm">
          {ok}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!b.enabled}
          onChange={(e) => setB({ ...b, enabled: e.target.checked })}
        />
        Включить баннер
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Заголовок (необязательно)</span>
        <input
          className="rounded-xl border p-2"
          value={b.title ?? ""}
          onChange={(e) => setB({ ...b, title: e.target.value })}
          placeholder="Можно оставить пустым"
        />
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Подзаголовок</span>
        <input
          className="rounded-xl border p-2"
          value={b.subtitle ?? ""}
          onChange={(e) => setB({ ...b, subtitle: e.target.value })}
          placeholder="(необязательно)"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Текст кнопки</span>
          <input
            className="rounded-xl border p-2"
            value={b.buttonText ?? ""}
            onChange={(e) => setB({ ...b, buttonText: e.target.value })}
            placeholder="(необязательно)"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Ссылка кнопки</span>
          <input
            className="rounded-xl border p-2"
            value={b.buttonHref ?? ""}
            onChange={(e) => setB({ ...b, buttonHref: e.target.value })}
            placeholder="/#catalog"
          />
        </label>
      </div>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Затемнение (0–100)</span>
        <input
          type="number"
          className="rounded-xl border p-2"
          value={Number.isFinite(Number(b.overlay)) ? Number(b.overlay) : 25}
          min={0}
          max={100}
          onChange={(e) => setB({ ...b, overlay: Number(e.target.value) })}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Фоновое изображение (ПК)</span>
          <input
            type="file"
            accept="image/*"
            className="rounded-xl border p-2"
            onChange={(e) => setFileDesktop(e.target.files?.[0] ?? null)}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Фоновое изображение (Телефон)</span>
          <input
            type="file"
            accept="image/*"
            className="rounded-xl border p-2"
            onChange={(e) => setFileMobile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border p-3">
          <div className="text-xs text-gray-600">ПК — текущее</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={b.imageDesktop ?? "https://picsum.photos/seed/hero-desktop/900/500"}
            alt=""
            className="mt-2 h-36 w-full rounded-xl border object-cover"
          />

          {previewDesktop ? (
            <>
              <div className="mt-3 text-xs text-gray-600">ПК — новое</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewDesktop}
                alt=""
                className="mt-2 h-36 w-full rounded-xl border object-cover"
              />
            </>
          ) : null}
        </div>

        <div className="rounded-2xl border p-3">
          <div className="text-xs text-gray-600">Телефон — текущее</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={b.imageMobile ?? "https://picsum.photos/seed/hero-mobile/600/900"}
            alt=""
            className="mt-2 h-36 w-full rounded-xl border object-cover"
          />

          {previewMobile ? (
            <>
              <div className="mt-3 text-xs text-gray-600">Телефон — новое</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewMobile}
                alt=""
                className="mt-2 h-36 w-full rounded-xl border object-cover"
              />
            </>
          ) : null}
        </div>
      </div>

      <button
        className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
        disabled={saving || uploading}
        onClick={save}
      >
        {uploading ? "Загружаю..." : saving ? "Сохраняю..." : "Сохранить"}
      </button>

      <div className="text-xs text-gray-500">
        Пустые поля (подзаголовок/кнопка/ссылки) сохраняются как <b>null</b>. Заголовок может быть пустым.
      </div>
    </div>
  );
}
