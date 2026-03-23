"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; title: string; slug: string };

type VariantRow = {
  size: string;
  stock: string;
  color?: string;
};

type ProductInput = {
  id: string;
  title: string;
  slug: string;
  price: number;
  discountPrice?: number | null;
  description: string;
  homeImage: string | null;
  galleryImages: string[];
  variants: { id?: string; size: string; color: string; stock: number }[];
  categoryId: string | null;
  isSoon: boolean;
  discountPercent: number;
  sizeChartImage?: string | null;
};

type GalleryItem = {
  id: string;
  kind: "existing" | "new";
  url: string;
  file?: File;
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

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
  const [priceRub, setPriceRub] = useState(
    String((product.price / 100).toFixed(0))
  );

  const [discountPriceRub, setDiscountPriceRub] = useState(
    product.discountPrice != null && product.discountPrice > 0
      ? String((product.discountPrice / 100).toFixed(0))
      : ""
  );

  const [categoryId, setCategoryId] = useState<string>(product.categoryId ?? "");
  const [discountPercent, setDiscountPercent] = useState(
    String(product.discountPercent ?? 0)
  );

  const [homeUrl, setHomeUrl] = useState<string>(product.homeImage ?? "");
  const [homeFile, setHomeFile] = useState<File | null>(null);
  const [homePreview, setHomePreview] = useState<string>("");

  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(
    (product.galleryImages ?? []).map((url) => ({
      id: makeId(),
      kind: "existing",
      url,
    }))
  );
  const [draggedGalleryIndex, setDraggedGalleryIndex] = useState<number | null>(
    null
  );

  const galleryItemsRef = useRef<GalleryItem[]>(galleryItems);
  useEffect(() => {
    galleryItemsRef.current = galleryItems;
  }, [galleryItems]);

  const [sizeChartUrl, setSizeChartUrl] = useState<string>(
    product.sizeChartImage ?? ""
  );
  const [sizeChartFile, setSizeChartFile] = useState<File | null>(null);
  const [sizeChartPreview, setSizeChartPreview] = useState<string>("");

  const [variants, setVariants] = useState<VariantRow[]>(
    (
      product.variants?.length
        ? product.variants
        : [{ size: "ONE", stock: "0", color: "default" }]
    ).map((v) => ({
      size: v.size,
      stock: String(v.stock ?? 0),
      color: v.color ?? "default",
    }))
  );

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const computedSlug = useMemo(
    () => (slug.trim() ? slug.trim() : slugify(title)),
    [slug, title]
  );

  const totalStock = useMemo(() => {
    return variants.reduce((sum, v) => {
      const n = Number(v.stock);
      return sum + (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
    }, 0);
  }, [variants]);

  useEffect(() => {
    if (isSoon) {
      setPriceRub("0");
      setDiscountPriceRub("");
      setDiscountPercent("0");
      setVariants([{ size: "ONE", stock: "0", color: "default" }]);
    }
  }, [isSoon]);

  useEffect(() => {
    if (!homeFile) {
      setHomePreview("");
      return;
    }
    const url = URL.createObjectURL(homeFile);
    setHomePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [homeFile]);

  useEffect(() => {
    if (!sizeChartFile) {
      setSizeChartPreview("");
      return;
    }
    const url = URL.createObjectURL(sizeChartFile);
    setSizeChartPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [sizeChartFile]);

  useEffect(() => {
    return () => {
      for (const item of galleryItemsRef.current) {
        if (item.kind === "new" && item.url.startsWith("blob:")) {
          URL.revokeObjectURL(item.url);
        }
      }
    };
  }, []);

  async function uploadOne(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();

    if (!res.ok) throw new Error(data?.error || "Не удалось загрузить фото");
    return String(data.url || "");
  }

  async function uploadGalleryInOrder(items: GalleryItem[]): Promise<string[]> {
    const out: string[] = [];

    for (const item of items) {
      if (item.kind === "existing") {
        out.push(item.url);
        continue;
      }

      if (!item.file) {
        throw new Error("Не найден файл для загрузки фото галереи");
      }

      const uploadedUrl = await uploadOne(item.file);
      out.push(uploadedUrl);
    }

    return out;
  }

  function addVariantRow() {
    setVariants((prev) => [
      ...prev,
      { size: "", stock: "0", color: "default" },
    ]);
  }

  function removeVariantRow(idx: number) {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateVariantRow(idx: number, patch: Partial<VariantRow>) {
    setVariants((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
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
      if (!isValidNonNegativeIntString(v.stock)) {
        return `Некорректный stock у размера ${v.size}`;
      }
    }

    return null;
  }

  function moveGalleryItem(from: number, to: number) {
    setGalleryItems((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  }

  function addGalleryFiles(files: FileList | null) {
    if (!files?.length) return;

    const nextItems: GalleryItem[] = Array.from(files).map((file) => ({
      id: makeId(),
      kind: "new",
      url: URL.createObjectURL(file),
      file,
    }));

    setGalleryItems((prev) => [...prev, ...nextItems]);
  }

  function removeGalleryItem(idx: number) {
    setGalleryItems((prev) => {
      const item = prev[idx];
      if (item?.kind === "new" && item.url.startsWith("blob:")) {
        URL.revokeObjectURL(item.url);
      }
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function save() {
    setErr(null);
    setOk(null);

    if (title.trim().length < 2) return setErr("Название слишком короткое");
    if (computedSlug.length < 2) return setErr("Slug слишком короткий");

    const hasHome = Boolean(homeFile) || Boolean(homeUrl);
    if (!hasHome) return setErr("Нужно фото на главную (обложка)");

    if (galleryItems.length === 0) {
      return setErr("Добавь хотя бы одно фото в галерею");
    }

    if (!isSoon) {
      if (!isValidPositiveNumberString(priceRub)) {
        return setErr("Некорректная цена (без скидки)");
      }

      const d = parseDiscount(discountPercent);
      if (d === null) return setErr("Некорректная скидка (0..99)");

      const dp = discountPriceRub.trim();
      if (dp) {
        if (!isValidPositiveNumberString(dp)) {
          return setErr("Некорректная цена со скидкой");
        }

        const base = Number(String(priceRub).replace(",", "."));
        const disc = Number(String(dp).replace(",", "."));

        if (disc >= base) {
          return setErr("Цена со скидкой должна быть меньше обычной цены");
        }
      }

      const vErr = validateVariants();
      if (vErr) return setErr(vErr);
    }

    setSaving(true);
    setUploading(true);

    try {
      let nextHome = homeUrl;
      if (homeFile) {
        nextHome = await uploadOne(homeFile);
      }

      let nextSizeChart = sizeChartUrl;
      if (sizeChartFile) {
        nextSizeChart = await uploadOne(sizeChartFile);
      }

      const nextGallery = await uploadGalleryInOrder(galleryItems);

      const payload: any = {
        title: title.trim(),
        slug: computedSlug,
        categoryId: categoryId || null,
        isSoon,
        description: description.trim() || "",
        homeImage: nextHome,
        images: nextGallery,
        sizeChartImage: nextSizeChart || null,
      };

      if (!isSoon) {
        payload.priceRub = priceRub;
        payload.discountPriceRub = discountPriceRub.trim()
          ? discountPriceRub.trim()
          : null;
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
        payload.discountPriceRub = null;
        payload.variants = [{ size: "ONE", color: "default", stock: 0 }];
      }

      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Не удалось сохранить");

      for (const item of galleryItems) {
        if (item.kind === "new" && item.url.startsWith("blob:")) {
          URL.revokeObjectURL(item.url);
        }
      }

      setGalleryItems(
        nextGallery.map((url) => ({
          id: makeId(),
          kind: "existing",
          url,
        }))
      );

      setOk("Сохранено ✅");
      setHomeFile(null);
      setHomePreview("");
      setSizeChartFile(null);
      setSizeChartPreview("");

      if (nextHome) setHomeUrl(nextHome);
      setSizeChartUrl(nextSizeChart || "");

      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  async function remove() {
    if (!confirm("Удалить товар? Это действие нельзя отменить.")) return;

    setErr(null);
    setOk(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "DELETE",
      });
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

      <label className="grid gap-1">
        <span className="text-sm font-medium">Название</span>
        <input
          className="rounded-xl border p-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Категория</span>
        <select
          className="rounded-xl border p-2"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">— Без категории —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <div className="text-xs text-gray-600">
          Если убрать категорию — товар исчезнет из категорий на главной/в
          шапке.
        </div>
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Описание</span>
        <textarea
          className="min-h-[120px] rounded-xl border p-2"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Описание товара"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isSoon}
          onChange={(e) => setIsSoon(e.target.checked)}
        />
        Скоро (цена/скидка/размеры не нужны)
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Цена — без скидки</span>
        <input
          className="rounded-xl border p-2"
          value={priceRub}
          onChange={(e) => setPriceRub(e.target.value)}
          disabled={isSoon}
          inputMode="decimal"
        />
        {isSoon ? (
          <div className="text-xs text-gray-600">
            В режиме "Скоро" цена не нужна.
          </div>
        ) : null}
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Цена со скидкой — если есть</span>
        <input
          className="rounded-xl border p-2"
          value={discountPriceRub}
          onChange={(e) => setDiscountPriceRub(e.target.value)}
          disabled={isSoon}
          placeholder="например 1490"
          inputMode="decimal"
        />
        {isSoon ? (
          <div className="text-xs text-gray-600">
            В режиме "Скоро" цена со скидкой не нужна.
          </div>
        ) : (
          <div className="text-xs text-gray-600">
            Оставь пустым — скидки нет. Если заполнено — должно быть меньше
            обычной цены.
          </div>
        )}
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
        {isSoon ? (
          <div className="text-xs text-gray-600">
            В режиме "Скоро" скидка не нужна.
          </div>
        ) : null}
        {!isSoon ? (
          <div className="text-xs text-gray-600">
            от 0 до 99 (если 0 — плашка не показывается)
          </div>
        ) : null}
      </label>

      <div className="grid gap-2">
        <div className="text-sm font-medium">Фото на главную</div>

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
            <div className="text-xs text-gray-600">Новое</div>
            <input
              type="file"
              accept="image/*"
              className="rounded-xl border p-2"
              onChange={(e) => setHomeFile(e.target.files?.[0] ?? null)}
            />
            {homePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={homePreview}
                alt="home preview"
                className="h-32 w-32 rounded-xl border object-cover"
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="text-sm font-medium">Фото галереи</div>

        {galleryItems.length ? (
          <div className="flex flex-wrap gap-2">
            {galleryItems.map((item, idx) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDraggedGalleryIndex(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (
                    draggedGalleryIndex === null ||
                    draggedGalleryIndex === idx
                  ) {
                    return;
                  }
                  moveGalleryItem(draggedGalleryIndex, idx);
                  setDraggedGalleryIndex(null);
                }}
                onDragEnd={() => setDraggedGalleryIndex(null)}
                className={`relative cursor-move rounded-xl ${
                  draggedGalleryIndex === idx ? "opacity-50" : ""
                }`}
                title="Перетащи, чтобы поменять местами"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={`gallery-${idx}`}
                  className="h-24 w-24 rounded-xl border object-cover"
                />

                <div className="absolute bottom-1 left-1 rounded-md border bg-white/90 px-2 py-0.5 text-[10px]">
                  {idx + 1}
                </div>

                {item.kind === "new" ? (
                  <div className="absolute bottom-1 right-1 rounded-md border bg-black/80 px-2 py-0.5 text-[10px] text-white">
                    new
                  </div>
                ) : null}

                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-md border bg-white/90 px-2 py-1 text-[11px]"
                  onClick={() => removeGalleryItem(idx)}
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
          <div className="text-xs text-gray-600">
            Добавить новые фото. Можно удалять и менять местами до сохранения.
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            className="rounded-xl border p-2"
            onChange={(e) => {
              addGalleryFiles(e.target.files);
              e.currentTarget.value = "";
            }}
          />
        </div>
      </div>

      <div className="rounded-xl border p-3">
        <div className="text-sm font-medium">Таблица размеров</div>

        <div className="mt-2 flex flex-wrap items-start gap-4">
          <div className="grid gap-2">
            <div className="text-xs text-gray-600">Текущая</div>
            {sizeChartUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sizeChartUrl}
                alt="size chart"
                className="h-32 w-32 rounded-xl border object-cover"
              />
            ) : (
              <div className="text-xs text-gray-600">Не прикреплена.</div>
            )}

            {sizeChartUrl ? (
              <button
                type="button"
                className="text-xs text-red-700 underline"
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
              <img
                src={sizeChartPreview}
                alt="size chart preview"
                className="h-32 w-32 rounded-xl border object-cover"
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Размеры</div>
          <button
            type="button"
            className="text-sm underline disabled:opacity-40"
            onClick={addVariantRow}
            disabled={isSoon}
          >
            + Добавить размер
          </button>
        </div>

        <div className="mt-1 text-xs text-gray-600">
          Общий остаток: <b>{totalStock}</b>
        </div>

        {isSoon ? (
          <div className="mt-2 text-xs text-gray-600">
            В режиме "Скоро" размеры не нужны.
          </div>
        ) : null}

        <div className="mt-3 grid gap-2">
          {variants.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                className="w-[120px] rounded-xl border p-2"
                value={row.size}
                onChange={(e) =>
                  updateVariantRow(idx, { size: e.target.value })
                }
                placeholder="S / M / L"
                disabled={isSoon}
              />
              <input
                className="w-[140px] rounded-xl border p-2"
                value={row.stock}
                onChange={(e) =>
                  updateVariantRow(idx, { stock: e.target.value })
                }
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
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
          disabled={saving || uploading}
          onClick={save}
        >
          {uploading ? "Загружаю фото..." : saving ? "Сохраняю..." : "Сохранить"}
        </button>

        <button
          className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={saving || uploading}
          onClick={() => router.push("/admin/products")}
        >
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