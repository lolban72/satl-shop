"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; title: string; slug: string };

type VariantRow = {
  size: string;
  stock: string; // строкой для инпутов
  color?: string; // опционально, у тебя default
};

type ProductInput = {
  id: string;
  title: string;
  slug: string;
  price: number;

  description: string;

  homeImage: string | null; // images[0]
  galleryImages: string[]; // images.slice(1)

  variants: { id?: string; size: string; color: string; stock: number }[];

  categoryId: string | null;

  isSoon: boolean;
  discountPercent: number;

  // ✅ таблица размеров (URL картинки)
  sizeChartImage?: string | null;
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "")
    .trim();
}

function isValidPositiveNumberString(s: string) {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) && n > 0;
}
function isValidNonNegativeIntString(s: string) {
  const n = Number(s);
  return Number.isFinite(n) && Number.isInteger(n) && n >= 0;
}
function parseDiscount(s: string): number | null {
  const n = Math.floor(Number(s));
  if (!Number.isFinite(n) || n < 0 || n > 99) return null;
  return n;
}
function normSize(s: string) {
  return s.trim().toUpperCase();
}

export default function ProductEditForm({
  product,
  categories,
}: {
  product: ProductInput;
  categories: Category[];
}) {
  const router = useRouter();

  const [title, setTitle] = useState(product.title);
  const [slug, setSlug] = useState(product.slug);

  const [description, setDescription] = useState(product.description ?? "");

  const [isSoon, setIsSoon] = useState(Boolean(product.isSoon));
  const [priceRub, setPriceRub] = useState(String((product.price / 100).toFixed(0)));
  const [categoryId, setCategoryId] = useState<string>(product.categoryId ?? "");

  const [discountPercent, setDiscountPercent] = useState(String(product.discountPercent ?? 0));

  // ✅ Обложка
  const [homeUrl, setHomeUrl] = useState<string>(product.homeImage ?? "");
  const [homeFile, setHomeFile] = useState<File | null>(null);
  const [homePreview, setHomePreview] = useState<string>("");

  // ✅ Галерея (URL’ы)
  const [galleryUrls, setGalleryUrls] = useState<string[]>(product.galleryImages ?? []);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);

  // ✅ Таблица размеров (URL + файл + превью)
  const [sizeChartUrl, setSizeChartUrl] = useState<string>(product.sizeChartImage ?? "");
  const [sizeChartFile, setSizeChartFile] = useState<File | null>(null);
  const [sizeChartPreview, setSizeChartPreview] = useState<string>("");

  // ✅ Размеры
  const [variants, setVariants] = useState<VariantRow[]>(
    (product.variants?.length ? product.variants : [{ size: "ONE", stock: "0", color: "default" }]).map((v) => ({
      size: v.size,
      stock: String(v.stock ?? 0),
      color: v.color ?? "default",
    }))
  );

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const computedSlug = useMemo(() => (slug.trim() ? slug.trim() : slugify(title)), [slug, title]);

  const totalStock = useMemo(() => {
    return variants.reduce((sum, v) => {
      const n = Number(v.stock);
      return sum + (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
    }, 0);
  }, [variants]);

  // ✅ при "Скоро" — скидка 0 и цена 0, а варианты делаем ONE/0
  useEffect(() => {
    if (isSoon) {
      setPriceRub("0");
      setDiscountPercent("0");
      setVariants([{ size: "ONE", stock: "0", color: "default" }]);
    }
  }, [isSoon]);

  // preview: home
  useEffect(() => {
    if (!homeFile) {
      setHomePreview("");
      return;
    }
    const url = URL.createObjectURL(homeFile);
    setHomePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [homeFile]);

  // preview: gallery files
  useEffect(() => {
    if (!galleryFiles.length) {
      setGalleryPreviews([]);
      return;
    }
    const urls = galleryFiles.map((f) => URL.createObjectURL(f));
    setGalleryPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [galleryFiles]);

  // preview: size chart
  useEffect(() => {
    if (!sizeChartFile) {
      setSizeChartPreview("");
      return;
    }
    const url = URL.createObjectURL(sizeChartFile);
    setSizeChartPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [sizeChartFile]);

  async function uploadOne(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Не удалось загрузить фото");

    return String(data.url || "");
  }

  async function uploadAll(): Promise<{ home?: string; gallery: string[]; sizeChart?: string }> {
    setUploading(true);
    try {
      const outGallery: string[] = [];

      let nextHome: string | undefined = undefined;
      if (homeFile) nextHome = await uploadOne(homeFile);

      let nextSizeChart: string | undefined = undefined;
      if (sizeChartFile) nextSizeChart = await uploadOne(sizeChartFile);

      for (const f of galleryFiles) {
        const u = await uploadOne(f);
        if (u) outGallery.push(u);
      }

      return { home: nextHome, gallery: outGallery, sizeChart: nextSizeChart };
    } finally {
      setUploading(false);
    }
  }

  function addVariantRow() {
    setVariants((prev) => [...prev, { size: "", stock: "0", color: "default" }]);
  }
  function removeVariantRow(idx: number) {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateVariantRow(idx: number, patch: Partial<VariantRow>) {
    setVariants((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function validateVariants(): string | null {
    if (isSoon) return null;

    const cleaned = variants
      .map((v) => ({ size: normSize(v.size), stock: v.stock.trim() }))
      .filter((v) => v.size.length > 0);

    if (cleaned.length === 0) return "Добавь хотя бы один размер";

    const seen = new Set<string>();
    for (const v of cleaned) {
      if (seen.has(v.size)) return `Дублируется размер: ${v.size}`;
      seen.add(v.size);
      if (!isValidNonNegativeIntString(v.stock)) return `Некорректный stock у размера ${v.size}`;
    }

    return null;
  }

  async function save() {
    setErr(null);
    setOk(null);

    if (title.trim().length < 2) return setErr("Название слишком короткое");
    if (computedSlug.length < 2) return setErr("Slug слишком короткий");

    // фото обязательно (обложка + минимум 1 в галерее)
    const hasHome = Boolean(homeFile) || Boolean(homeUrl);
    if (!hasHome) return setErr("Нужно фото на главную (обложка)");

    const hasGallery = (galleryUrls?.length ?? 0) + (galleryFiles?.length ?? 0) > 0;
    if (!hasGallery) return setErr("Добавь хотя бы одно фото в галерею");

    if (!isSoon) {
      if (!isValidPositiveNumberString(priceRub)) return setErr("Некорректная цена");
      const d = parseDiscount(discountPercent);
      if (d === null) return setErr("Некорректная скидка (0..99)");

      const vErr = validateVariants();
      if (vErr) return setErr(vErr);
    }

    setSaving(true);
    try {
      // upload new files (если выбраны)
      const uploaded = await uploadAll();

      const nextHome = uploaded.home ?? homeUrl; // если новый не загружали — оставляем старый

      const nextGallery = [...galleryUrls, ...uploaded.gallery].filter(Boolean);

      // таблица размеров: новый upload или старый URL (или пусто)
      const nextSizeChart = uploaded.sizeChart ?? sizeChartUrl ?? "";

      // payload
      const payload: any = {
        title: title.trim(),
        slug: computedSlug,
        categoryId: categoryId || null,
        isSoon,

        description: description.trim() || "",

        homeImage: nextHome,
        images: nextGallery, // только галерея, без обложки

        // ✅ добавили
        sizeChartImage: nextSizeChart || null,
      };

      if (!isSoon) {
        payload.priceRub = priceRub;
        payload.discountPercent = parseDiscount(discountPercent) ?? 0;

        payload.variants = variants
          .map((v) => ({
            size: normSize(v.size),
            color: (v.color ?? "default").trim() || "default",
            stock: Math.floor(Number(v.stock)),
          }))
          .filter((v) => v.size.length > 0);
      } else {
        payload.discountPercent = 0;
        payload.variants = [{ size: "ONE", color: "default", stock: 0 }];
      }

      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Не удалось сохранить");

      setOk("Сохранено ✅");

      // сброс только новых файлов/превью
      setHomeFile(null);
      setHomePreview("");
      setGalleryFiles([]);
      setGalleryPreviews([]);

      setSizeChartFile(null);
      setSizeChartPreview("");

      // обновляем URL’ы если загрузили новые
      if (uploaded.home) setHomeUrl(uploaded.home);
      if (uploaded.gallery.length) setGalleryUrls((prev) => [...prev, ...uploaded.gallery]);
      if (uploaded.sizeChart) setSizeChartUrl(uploaded.sizeChart);

      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Удалить товар? Это действие нельзя отменить.")) return;

    setErr(null);
    setOk(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Не удалось удалить");

      router.push("/admin/products");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 grid gap-3">
      {err && <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm">{err}</div>}
      {ok && <div className="rounded-xl border border-green-300 bg-green-50 p-3 text-sm">{ok}</div>}

      <label className="grid gap-1">
        <span className="text-sm font-medium">Название</span>
        <input className="rounded-xl border p-2" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Slug</span>
        <input className="rounded-xl border p-2" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <div className="text-xs text-gray-600">
          Итоговый slug: <b>{computedSlug || "—"}</b>
        </div>
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Категория</span>
        <select className="rounded-xl border p-2" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">— Без категории —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <div className="text-xs text-gray-600">Если убрать категорию — товар исчезнет из категорий на главной/в шапке.</div>
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Описание</span>
        <textarea
          className="rounded-xl border p-2 min-h-[120px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Описание товара (показывается на странице товара)"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isSoon} onChange={(e) => setIsSoon(e.target.checked)} />
        Скоро (цена/скидка/размеры не нужны)
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Цена (р)</span>
        <input className="rounded-xl border p-2" value={priceRub} onChange={(e) => setPriceRub(e.target.value)} disabled={isSoon} />
        {isSoon ? <div className="text-xs text-gray-600">В режиме "Скоро" цена не нужна.</div> : null}
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Скидка (%)</span>
        <input
          className="rounded-xl border p-2"
          value={discountPercent}
          onChange={(e) => setDiscountPercent(e.target.value)}
          disabled={isSoon}
          placeholder="0"
          inputMode="numeric"
        />
        {isSoon ? <div className="text-xs text-gray-600">В режиме "Скоро" скидка не нужна.</div> : null}
        {!isSoon ? <div className="text-xs text-gray-600">0..99 (если 0 — плашка не показывается)</div> : null}
      </label>

      {/* ✅ Обложка */}
      <div className="grid gap-2">
        <div className="text-sm font-medium">Фото на главную (обложка)</div>

        <div className="flex flex-wrap items-start gap-4">
          <div className="grid gap-2">
            <div className="text-xs text-gray-600">Текущее</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={homeUrl || "https://picsum.photos/seed/placeholder/200/200"}
              alt="home"
              className="h-32 w-32 rounded-xl border object-cover"
            />
          </div>

          <div className="grid gap-2">
            <div className="text-xs text-gray-600">Новое (если нужно заменить)</div>
            <input type="file" accept="image/*" className="rounded-xl border p-2" onChange={(e) => setHomeFile(e.target.files?.[0] ?? null)} />
            {homePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={homePreview} alt="home preview" className="h-32 w-32 rounded-xl border object-cover" />
            ) : null}
          </div>
        </div>
      </div>

      {/* ✅ Галерея */}
      <div className="grid gap-2">
        <div className="text-sm font-medium">Фото галереи</div>

        {galleryUrls.length ? (
          <div className="flex flex-wrap gap-2">
            {galleryUrls.map((u, idx) => (
              <div key={u + idx} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`gallery-${idx}`} className="h-24 w-24 rounded-xl border object-cover" />
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-md bg-white/90 border px-2 py-1 text-[11px]"
                  onClick={() => setGalleryUrls((prev) => prev.filter((_, i) => i !== idx))}
                  title="Удалить"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-600">Пока нет фото в галерее.</div>
        )}

        <div className="grid gap-1">
          <div className="text-xs text-gray-600">Добавить новые фото</div>
          <input type="file" accept="image/*" multiple className="rounded-xl border p-2" onChange={(e) => setGalleryFiles(Array.from(e.target.files ?? []))} />
        </div>

        {galleryPreviews.length ? (
          <div className="flex flex-wrap gap-2">
            {galleryPreviews.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src + i} src={src} alt={`new-${i}`} className="h-24 w-24 rounded-xl border object-cover" />
            ))}
          </div>
        ) : null}
      </div>

      {/* ✅ Таблица размеров */}
      <div className="rounded-xl border p-3">
        <div className="text-sm font-medium">Таблица размеров (картинка)</div>

        <div className="mt-2 flex flex-wrap items-start gap-4">
          <div className="grid gap-2">
            <div className="text-xs text-gray-600">Текущая</div>
            {sizeChartUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sizeChartUrl} alt="size chart" className="h-32 w-32 rounded-xl border object-cover" />
            ) : (
              <div className="text-xs text-gray-600">Не прикреплена.</div>
            )}

            {sizeChartUrl ? (
              <button
                type="button"
                className="text-xs underline text-red-700"
                onClick={() => {
                  setSizeChartUrl("");
                  setSizeChartFile(null);
                  setSizeChartPreview("");
                }}
              >
                Удалить таблицу размеров
              </button>
            ) : null}
          </div>

          <div className="grid gap-2">
            <div className="text-xs text-gray-600">Загрузить новую</div>
            <input
              type="file"
              accept="image/*"
              className="rounded-xl border p-2"
              onChange={(e) => setSizeChartFile(e.target.files?.[0] ?? null)}
            />
            {sizeChartPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sizeChartPreview} alt="size chart preview" className="h-32 w-32 rounded-xl border object-cover" />
            ) : null}
            <div className="text-[11px] text-gray-500">Если загрузишь — при сохранении заменит текущую.</div>
          </div>
        </div>
      </div>

      {/* ✅ Размеры */}
      <div className="rounded-xl border p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Размеры</div>
          <button type="button" className="text-sm underline disabled:opacity-40" onClick={addVariantRow} disabled={isSoon}>
            + Добавить размер
          </button>
        </div>

        <div className="mt-1 text-xs text-gray-600">
          Общий остаток: <b>{totalStock}</b>
        </div>

        {isSoon ? <div className="mt-2 text-xs text-gray-600">В режиме "Скоро" размеры не нужны.</div> : null}

        <div className="mt-3 grid gap-2">
          {variants.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                className="w-[120px] rounded-xl border p-2"
                value={row.size}
                onChange={(e) => updateVariantRow(idx, { size: e.target.value })}
                placeholder="S / M / L"
                disabled={isSoon}
              />
              <input
                className="w-[140px] rounded-xl border p-2"
                value={row.stock}
                onChange={(e) => updateVariantRow(idx, { stock: e.target.value })}
                placeholder="stock"
                inputMode="numeric"
                disabled={isSoon}
              />
              <button
                type="button"
                className="text-sm text-red-600 underline disabled:opacity-40"
                onClick={() => removeVariantRow(idx)}
                disabled={isSoon || variants.length <= 1}
              >
                Удалить
              </button>
            </div>
          ))}
          {!isSoon ? <div className="text-xs text-gray-600">Сохраняется в Variant (color = default).</div> : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50" disabled={saving || uploading} onClick={save}>
          {uploading ? "Загружаю фото..." : saving ? "Сохраняю..." : "Сохранить"}
        </button>

        <button className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50" disabled={saving || uploading} onClick={() => router.push("/admin/products")}>
          Назад
        </button>

        <button
          className="ml-auto rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
          disabled={saving || uploading}
          onClick={remove}
        >
          Удалить
        </button>
      </div>
    </div>
  );
}
