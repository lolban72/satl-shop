import { prisma } from "@/lib/prisma";
import ProductGallery from "./ui/ProductGallery";
import AddToCart from "./ui/AddToCart";
import ProductCard from "@/components/ProductCard";

function calcOldPrice(price: number, discountPercent?: number | null) {
  const d = Number(discountPercent ?? 0);
  if (!d || d <= 0 || d >= 100) return null;
  const old = Math.round(price / (1 - d / 100));
  return old > price ? old : null;
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

  const oldPrice = calcOldPrice(product.price, product.discountPercent);

  const products = await prisma.product.findMany({
    where: { id: { not: product.id } },
    orderBy: { createdAt: "desc" },
    take: 24,
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
            <div className="text-[26px] md:text-[30px]" style={{ fontFamily: "Yeast" }}>
              {(product.price / 100).toFixed(0)}р
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

          {/* DISCOUNT */}
          {product.discountPercent > 0 && (
            <div className="text-[18px] md:text-[20px] font-bold text-[#B60404] mt-[-5px]">
              <span style={{ fontFamily: "Yeast" }} className="tracking-[0.02em]">
                -{product.discountPercent}
              </span>
              <span style={{ fontFamily: "YrsaBold" }} className="text-[15px] md:text-[17px]">
                %
              </span>
            </div>
          )}

          {/* SIZES + BUTTON */}
          <div className="mt-[14px] md:mt-[18px]">
            <AddToCart
              productId={product.id}
              title={product.title}
              price={product.price}
              image={product.images?.[0]}
              variants={product.variants}
              sizeChartImage={product.sizeChartImage} // передаем сюда ссылку на таблицу размеров
            />
          </div>

          {/* DESCRIPTION */}
          {product.description && (
            <div
              className="mt-[16px] md:mt-[22px] text-[13px] md:text-[15px] leading-[1.6] text-black/55"
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
          {products.map((p) => (
            <ProductCard
              key={p.id}
              slug={p.slug}
              title={p.title}
              price={p.price}
              imageUrl={p.images?.[0] ?? null}
              isSoon={p.isSoon}
              discountPercent={p.discountPercent ?? 0}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
