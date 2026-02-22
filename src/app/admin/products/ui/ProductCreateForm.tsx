"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Category = {
  id: string;
  title: string;
  slug: string;
  showOnHome?: boolean;
  showInNav?: boolean;
};

type SizeRow = {
  size: string;
  stock: string; // строка для инпута
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "");
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

export default function ProductCreateForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");

  const [description, setDescription] = useState("");

  // строки удобнее для инпутов
  const [priceRub, setPriceRub] = useState("1990");
  const [isSoon, setIsSoon] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("0");

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");

  // ✅ Фото на главную (обложка)
  const [homeFile, setHomeFile] = useState<File | null>(null);
  const [homePreview, setHomePreview] = useState<string>("");

  // ✅ Фото в галерею (несколько)
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);

  // ✅ NEW: Размерная таблица (изображение)
  const [sizeChartFile, setSizeChartFile] = useState<File | null>(null);
  const [sizeChartPreview, setSizeChartPreview] = useState<string>("");

  // ✅ Размеры (variants)
  const [sizes, setSizes] = useState<SizeRow[]>([
    { size: "S", stock: "10" },
    { size: "M", stock: "10" },
    { size: "L", stock: "10" },
  ]);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const computedSlug = useMemo(() => {
    const s = slug.trim();
    if (s) return s;
    return slugify(title);
  }, [slug, title]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/categories", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Не удалось загрузить категории");
        setCategories(data);
        if (data?.[0]?.id) setCategoryId(data[0].id);
      } catch (e: any) {
        setErr(e?.message || "Ошибка загрузки категорий");
      }
    })();
  }, []);

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

  // preview: gallery
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

  // если включили "Скоро" — скидка/цена/размеры не нужны
  useEffect(() => {
    if (isSoon) setDiscountPercent("0");
  }, [isSoon]);

  async function uploadOne(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Не удалось загрузить фото");

    return String(data.url || "");
  }

  async function uploadAll(): Promise<{
    homeUrl: string;
    galleryUrls: string[];
    sizeChartUrl: string | null;
  }> {
    setUploading(true);
    try {
      const homeUrl = homeFile ? await uploadOne(homeFile) : "";

      const galleryUrls: string[] = [];
      for (const f of galleryFiles) {
        const url = await uploadOne(f);
        if (url) galleryUrls.push(url);
      }

      const sizeChartUrl = sizeChartFile ? await uploadOne(sizeChartFile) : null;

      return { homeUrl, galleryUrls, sizeChartUrl };
    } finally {
      setUploading(false);
    }
  }

  function addSizeRow() {
    setSizes((prev) => [...prev, { size: "", stock: "0" }]);
  }

  function removeSizeRow(idx: number) {
    setSizes((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSizeRow(idx: number, patch: Partial<SizeRow>) {
    setSizes((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function validateSizes(): { ok: boolean; message?: string } {
    // только для НЕ soon
    const cleaned = sizes
      .map((r) => ({ size: normSize(r.size), stock: r.stock.trim() }))
      .filter((r) => r.size.length > 0);

    if (cleaned.length === 0) return { ok: false, message: "Добавь хотя бы один размер" };

    const seen = new Set<string>();
    for (const r of cleaned) {
      if (seen.has(r.size)) return { ok: false, message: `Дублируется размер: ${r.size}` };
      seen.add(r.size);

      if (!isValidNonNegativeIntString(r.stock)) {
        return { ok: false, message: `Некорректный stock у размера ${r.size}` };
      }
    }

    return { ok: true };
  }

  async function submit() {
    setErr(null);
    setOk(null);

    const t = title.trim();
    if (t.length < 2) return setErr("Название слишком короткое");

    if (!computedSlug || computedSlug.length < 2) return setErr("Slug слишком короткий");

    if (!categoryId) return setErr("Выбери категорию — иначе товар не попадёт на главную/в шапку");

    // фото на главную — обязательно (и для soon, и для обычного товара)
    if (!homeFile) return setErr("Загрузи фото на главную (обложку)");

    // галерея можно сделать обязательной — ты просил «фото на галерею», делаю минимум 1
    if (galleryFiles.length === 0) return setErr("Добавь хотя бы одно фото в галерею");

    if (!isSoon) {
      if (!isValidPositiveNumberString(priceRub)) return setErr("Некорректная цена");

      const d = parseDiscount(discountPercent);
      if (d === null) return setErr("Некорректная скидка (0..99)");

      const sizesCheck = validateSizes();
      if (!sizesCheck.ok) return setErr(sizesCheck.message || "Некорректные размеры");
    }

    setLoading(true);
    try {
      // 1) upload
      const { homeUrl, galleryUrls, sizeChartUrl } = await uploadAll();
      if (!homeUrl) throw new Error("Не удалось загрузить фото на главную");
      if (!galleryUrls.length) throw new Error("Не удалось загрузить фото галереи");

      // 2) payload
      const payload: any = {
        title: t,
        slug: computedSlug,
        isSoon,
        categoryId,
        description: description.trim() || undefined,

        // ✅ обложка + галерея
        homeImage: homeUrl, // фото на главную (обложка)
        images: galleryUrls, // фото галереи (массив)

        // ✅ NEW: размерная таблица
        sizeChartImage: sizeChartUrl, // string | null
      };

      if (!isSoon) {
        payload.priceRub = priceRub;
        payload.discountPercent = parseDiscount(discountPercent) ?? 0;

        // ✅ variants по размерам
        const cleaned = sizes
          .map((r) => ({ size: normSize(r.size), stock: Number(r.stock) }))
          .filter((r) => r.size.length > 0);

        payload.variants = cleaned.map((r) => ({
          size: r.size,
          color: "default",
          stock: r.stock,
        }));
      } else {
        payload.discountPercent = 0;
        payload.variants = []; // можно не отправлять вообще, но так безопаснее
      }

      // 3) create
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Не удалось создать товар");

      setOk(`Создано: ${data.slug ?? computedSlug}`);

      // reset
      setTitle("");
      setSlug("");
      setDescription("");
      setPriceRub("1990");
      setIsSoon(false);
      setDiscountPercent("0");

      setHomeFile(null);
      setGalleryFiles([]);

      setSizeChartFile(null);

      setSizes([
        { size: "S", stock: "10" },
        { size: "M", stock: "10" },
        { size: "L", stock: "10" },
      ]);

      router.refresh();
      router.push("/admin/products");
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  const disableSubmit =
    loading ||
    uploading ||
    categories.length === 0 ||
    !categoryId ||
    !homeFile ||
    galleryFiles.length === 0;

  return (
    <div className="mt-4 grid gap-3">
      {err && <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm">{err}</div>}
      {ok && <div className="rounded-xl border border-green-300 bg-green-50 p-3 text-sm">{ok}</div>}

      <label className="grid gap-1">
        <span className="text-sm font-medium">Название</span>
        <input className="rounded-xl border p-2" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Slug (необязательно)</span>
        <input
          className="rounded-xl border p-2"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="hoodie-gray"
        />
        <div className="text-xs text-gray-600">
          Итоговый slug: <b>{computedSlug || "—"}</b>
        </div>
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Категория</span>
        <select className="rounded-xl border p-2" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.length === 0 ? (
            <option value="">Сначала добавь категории</option>
          ) : (
            categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))
          )}
        </select>
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Описание</span>
        <textarea
          className="rounded-xl border p-2 min-h-[110px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Описание товара (будет на странице товара)"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isSoon} onChange={(e) => setIsSoon(e.target.checked)} />
        Скоро (цена/скидка/размеры не нужны)
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Цена (р)</span>
        <input
          className="rounded-xl border p-2"
          value={priceRub}
          onChange={(e) => setPriceRub(e.target.value)}
          disabled={isSoon}
          placeholder="0"
        />
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

      {/* ✅ Фото на главную */}
      <label className="grid gap-1">
        <span className="text-sm font-medium">Фото на главную (обложка)</span>
        <input
          type="file"
          accept="image/*"
          className="rounded-xl border p-2"
          onChange={(e) => setHomeFile(e.target.files?.[0] ?? null)}
        />
        {!homeFile ? <div className="text-xs text-red-600">Обложка обязательна.</div> : null}
      </label>

      {homePreview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={homePreview} alt="home preview" className="h-40 w-40 rounded-xl border object-cover" />
      ) : null}

      {/* ✅ Фото в галерею */}
      <label className="grid gap-1">
        <span className="text-sm font-medium">Фото в галерею (несколько)</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="rounded-xl border p-2"
          onChange={(e) => setGalleryFiles(Array.from(e.target.files ?? []))}
        />
        {galleryFiles.length === 0 ? (
          <div className="text-xs text-red-600">Добавь хотя бы одно фото в галерею.</div>
        ) : (
          <div className="text-xs text-gray-600">Выбрано: {galleryFiles.length} файл(ов)</div>
        )}
      </label>

      {galleryPreviews.length ? (
        <div className="flex flex-wrap gap-2">
          {galleryPreviews.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src + i} src={src} alt={`gallery-${i}`} className="h-24 w-24 rounded-xl border object-cover" />
          ))}
        </div>
      ) : null}

      {/* ✅ NEW: Размерная таблица */}
      <label className="grid gap-1">
        <span className="text-sm font-medium">Размерная таблица (картинка, необязательно)</span>
        <input
          type="file"
          accept="image/*"
          className="rounded-xl border p-2"
          onChange={(e) => setSizeChartFile(e.target.files?.[0] ?? null)}
        />
        <div className="text-xs text-gray-600">
          Будет показываться на странице товара по кнопке «Таблица размеров».
        </div>
      </label>

      {sizeChartPreview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sizeChartPreview} alt="size chart preview" className="h-40 w-40 rounded-xl border object-cover" />
      ) : null}

      {/* ✅ Размеры */}
      <div className="rounded-xl border p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Размеры</div>
          <button type="button" className="text-sm underline" onClick={addSizeRow} disabled={isSoon}>
            + Добавить размер
          </button>
        </div>

        {isSoon ? <div className="mt-2 text-xs text-gray-600">В режиме "Скоро" размеры не нужны.</div> : null}

        <div className="mt-3 grid gap-2">
          {sizes.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                className="w-[120px] rounded-xl border p-2"
                value={row.size}
                onChange={(e) => updateSizeRow(idx, { size: e.target.value })}
                placeholder="S / M / L"
                disabled={isSoon}
              />
              <input
                className="w-[140px] rounded-xl border p-2"
                value={row.stock}
                onChange={(e) => updateSizeRow(idx, { stock: e.target.value })}
                placeholder="stock"
                inputMode="numeric"
                disabled={isSoon}
              />
              <button
                type="button"
                className="text-sm text-red-600 underline disabled:opacity-40"
                onClick={() => removeSizeRow(idx)}
                disabled={isSoon || sizes.length <= 1}
              >
                Удалить
              </button>
            </div>
          ))}
          {!isSoon ? <div className="text-xs text-gray-600">Размеры будут созданы как variants (color = default).</div> : null}
        </div>
      </div>

      <button className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50" disabled={disableSubmit} onClick={submit}>
        {uploading ? "Загружаю фото..." : loading ? "Создаю..." : "Добавить"}
      </button>

      {categories.length === 0 ? (
        <div className="text-sm text-gray-600">
          Нет категорий. Сначала создай категорию в <b>/admin/categories</b>.
        </div>
      ) : null}
    </div>
  );
}
