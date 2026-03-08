import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import ProductGallery from "./ui/ProductGallery";
import AddToCart from "./ui/AddToCart";
import ProductCard from "@/components/ProductCard";

// ✅ чтобы generateMetadata работал с Prisma на сервере всегда
export const dynamic = "force-dynamic";

// ✅ показываем зачёркнутую "старую" цену только если есть discountPrice
function calcOldPrice(basePrice: number, discountPrice?: number | null) {
  const base = Number(basePrice ?? 0);
  const disc = discountPrice == null ? null : Number(discountPrice);

  if (!base || !disc || disc <= 0) return null;
  if (disc >= base) return null;

  return base;
}

// ✅ цена к оплате: если discountPrice задана — используем её, иначе обычная
function calcPayPrice(basePrice: number, discountPrice?: number | null) {
  const base = Number(basePrice ?? 0);
  const disc = discountPrice == null ? null : Number(discountPrice);

  if (disc && disc > 0 && disc < base) return disc;
  return base;
}

// ✅ есть ли товар в наличии
function hasStock(
  variants: Array<{ stock: number | null }> | null | undefined
): boolean {
  if (!Array.isArray(variants) || variants.length === 0) return false;
  return variants.some((v) => Number(v?.stock ?? 0) > 0);
}

// ✅ Динамический title/description для каждой карточки товара
export async function generateMetadata({
  params,
}: {
  // ✅ делаем как у тебя в page.tsx — params может приходить Promise
  params: Promise<{ slug: string }> | { slug: string };
}): Promise<Metadata> {
  // ✅ безопасно поддерживаем оба варианта
  const p =
    "then" in (params as any)
      ? await (params as Promise<{ slug: string }>)
      : (params as { slug: string });

  const slug = decodeURIComponent(p.slug);

  const product = await prisma.product.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      images: true,
    },
  });

  if (!product) {
    return {
      title: "Товар не найден | SATL",
      description: "К сожалению, этот товар не найден.",
    };
  }

  const title = `${product.title} | SATL`;
  const description =
    (product.description || "").trim().slice(0, 160) ||
    `Купить ${product.title} в интернет-магазине SATL.`;

  const ogImage =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images[0]
      : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ogImage ? [{ url: ogImage }] : [],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);

  const product = await prisma.product.findUnique({
    where: { slug },
    include: { variants: true },
  });

  if (!product) return <div className="p-6">Товар не найден</div>;

  // ✅ ТЕПЕРЬ:
  // price = цена БЕЗ скидки (из админки)
  // discountPrice = цена СО скидкой (если есть)
  const payPrice = calcPayPrice(product.price, (product as any).discountPrice);
  const oldPrice = calcOldPrice(product.price, (product as any).discountPrice);

  // ✅ плашку скидки показываем только если есть discountPrice
  const hasDiscount = Boolean(oldPrice);

  // ✅ есть ли товар в наличии
  const isSoldOut = !hasStock(product.variants);

  const products = await prisma.product.findMany({
    where: { id: { not: product.id } },
    orderBy: { createdAt: "desc" },
    take: 24,
    include: {
      variants: { select: { id: true, stock: true } },
    },
  });

  return (
    <div
      className="
        mx-auto max-w-[1440px]
        px-[14px] md:px-[65px]
        pt-[22px] md:pt-[80px]
        pb-[70px] md:pb-[120px]
      "
    >
      {/* ====== БЛОК ТОВАРА ====== */}
      <div
        className="
          flex flex-col md:flex-row
          items-start
          gap-[22px] md:gap-[90px]
        "
      >
        {/* LEFT */}
        <div className="w-full md:w-auto md:shrink-0">
          <ProductGallery images={product.images} title={product.title} />
        </div>

        {/* RIGHT */}
        <div className="w-full md:w-[420px] pt-0 md:pt-[40px]">
          {/* TITLE */}
          <h1
            className="text-[28px] md:text-[38px] leading-[1.05]"
            style={{ fontFamily: "Yeast" }}
          >
            {product.title}
          </h1>

          {/* PRICE */}
          <div className="mt-[12px] md:mt-[14px] flex items-end gap-[10px]">
            <div
              className="text-[18px] md:text-[30px]"
              style={{ fontFamily: "Yeast" }}
            >
              {(payPrice / 100).toFixed(0)}р
            </div>

            {oldPrice ? (
              <div
                className="text-[15px] md:text-[18px] text-black/40 line-through mb-[4px] md:mb-[5px]"
                style={{ fontFamily: "Yeast" }}
              >
                {(oldPrice / 100).toFixed(0)}р
              </div>
            ) : null}
          </div>

          {/* DISCOUNT (плашка) */}
          {product.discountPercent > 0 && hasDiscount && (
            <div className="text-[14px] md:text-[20px] font-bold text-[#B60404] mt-[-5px]">
              <span
                style={{ fontFamily: "Yeast" }}
                className="tracking-[0.02em]"
              >
                -{product.discountPercent}
              </span>
              <span
                style={{ fontFamily: "YrsaBold" }}
                className="text-[15px] md:text-[17px]"
              >
                %
              </span>
            </div>
          )}

          {/* SOLD OUT */}
          {isSoldOut ? (
            <div
              className="mt-[14px] md:mt-[18px] h-[52px] md:h-[56px] w-full border border-black bg-black text-white flex items-center justify-center text-[14px] md:text-[16px] uppercase tracking-[0.12em]"
              style={{ fontFamily: "Yeast" }}
            >
              Sold out
            </div>
          ) : (
            <div className="mt-[14px] md:mt-[18px]">
              <AddToCart
                productId={product.id}
                title={product.title}
                price={payPrice}
                image={product.images?.[0]}
                variants={product.variants}
                sizeChartImage={(product as any).sizeChartImage}
              />
            </div>
          )}

          {/* DESCRIPTION */}
          {product.description && (
            <div
              className="mt-[16px] md:mt-[22px] text-[13px] md:text-[15px] leading-[1.6] text-black/55 whitespace-pre-wrap"
              style={{ fontFamily: "Brygada" }}
            >
              {product.description}
            </div>
          )}
        </div>
      </div>

      {/* ====== КАТАЛОГ НИЖЕ ====== */}
      <section className="mt-[70px] md:mt-[250px] mx-auto max-w-6xl">
        <div
          className="
            grid justify-center justify-items-center
            grid-cols-2 md:grid-cols-2 xl:grid-cols-3
            gap-x-[12px] gap-y-[22px]
            md:gap-x-[300px] md:gap-y-[80px]
            md:grid-cols-2 xl:grid-cols-3
          "
        >
          {products.map((p) => {
            const discountPrice = (p as any).discountPrice as
              | number
              | null
              | undefined;

            const isSoldOutCard = !hasStock(p.variants);

            return (
              <ProductCard
                key={p.id}
                slug={p.slug}
                title={p.title}
                price={p.price}
                discountPrice={discountPrice ?? null}
                imageUrl={p.images?.[0] ?? null}
                isSoon={p.isSoon}
                discountPercent={p.discountPercent ?? 0}
                isSoldOut={isSoldOutCard}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}