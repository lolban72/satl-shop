import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import ProductGallery from "./ui/ProductGallery";
import AddToCart from "./ui/AddToCart";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";

// ✅ зачёркнутая цена = БАЗОВАЯ (price)
function calcOldPrice(basePrice: number, discountPrice?: number | null) {
  const base = Number(basePrice ?? 0);
  const disc = discountPrice == null ? null : Number(discountPrice);

  if (!base || disc == null) return null;
  if (disc <= 0) return null;
  if (disc >= base) return null;

  return base;
}

// ✅ цена к оплате
function calcPayPrice(basePrice: number, discountPrice?: number | null) {
  const base = Number(basePrice ?? 0);
  const disc = discountPrice == null ? null : Number(discountPrice);

  if (disc != null && disc > 0 && disc < base) return disc;
  return base;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}): Promise<Metadata> {
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

  // ⚠️ Если Prisma уже обновлён — можно убрать as any
  const discountPrice = (product as any).discountPrice as
    | number
    | null
    | undefined;

  const payPrice = calcPayPrice(product.price, discountPrice);
  const oldPrice = calcOldPrice(product.price, discountPrice);

  // ✅ плашка из discountPercent, но показываем только если есть реальная скидка
  const showDiscountBadge =
    Boolean(oldPrice) && (product.discountPercent ?? 0) > 0;

  const products = await prisma.product.findMany({
    where: { id: { not: product.id } },
    orderBy: { createdAt: "desc" },
    take: 24,
  });

  return (
    <div className="mx-auto max-w-[1440px] px-[14px] md:px-[65px] pt-[22px] md:pt-[80px] pb-[70px] md:pb-[120px]">
      <div className="flex flex-col md:flex-row items-start gap-[22px] md:gap-[90px]">
        <div className="w-full md:w-auto md:shrink-0">
          <ProductGallery images={product.images} title={product.title} />
        </div>

        <div className="w-full md:w-[420px] pt-0 md:pt-[40px]">
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

          {/* DISCOUNT BADGE */}
          {showDiscountBadge ? (
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
          ) : null}

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
    </div>
  );
}