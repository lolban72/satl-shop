import { prisma } from "@/lib/prisma";
import HeroBanner from "@/components/HeroBanner";
import ProductCard from "@/components/ProductCard";

export const metadata = {
  title: "SATL | официальный интернет-магазин",
  description:
    "Интернет-магазин одежды SATL. Новые коллекции, лимитированные релизы.",
};

// ✅ безопасная проверка discountPrice
function isValidDiscount(basePrice: number, discountPrice?: number | null) {
  const base = Number(basePrice ?? 0);
  const disc = discountPrice == null ? null : Number(discountPrice);
  return Boolean(base && disc && disc > 0 && disc < base);
}

// ✅ пересчитываем % скидки так, чтобы карточка дала ровно discountPrice (в копейках)
function calcPercentFromPrices(basePrice: number, discountPrice: number) {
  const base = Number(basePrice ?? 0);
  const disc = Number(discountPrice ?? 0);
  if (!base || !disc || disc <= 0 || disc >= base) return 0;

  // хотим percent такой, чтобы base - base*percent/100 ≈ disc
  // округляем до целого процента
  const raw = ((base - disc) * 100) / base;
  const pct = Math.round(raw);

  // ограничим адекватным диапазоном
  if (pct < 1) return 0;
  if (pct > 99) return 99;
  return pct;
}

export default async function HomePage() {
  const banner = await prisma.heroBanner.findFirst({
    orderBy: { createdAt: "asc" },
  });

  const categories = await prisma.category.findMany({
    where: {
      showOnHome: true,
      products: { some: {} },
    },
    orderBy: [{ homeOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      products: {
        orderBy: { createdAt: "desc" },
        include: {
          variants: {
            select: { id: true, stock: true },
          },
        },
      },
    },
  });

  return (
    <div>
      <HeroBanner banner={banner} />

      <section id="catalog" className="mx-auto max-w-6xl px-4 md:px-6 py-6">
        {categories.length === 0 ? (
          <p className="mt-4 text-gray-600">Пока нет категорий с товарами.</p>
        ) : (
          <div className="mt-6 grid gap-10">
            {categories.map((cat) => (
              <section
                key={cat.id}
                id={`cat-${cat.slug}`}
                className="scroll-mt-24"
              >
                {cat.products.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-600">
                    В этой категории пока нет товаров.
                  </p>
                ) : (
                  <div
                    className="
                      mt-6 grid
                      justify-center justify-items-center
                      grid-cols-2 md:grid-cols-2 xl:grid-cols-3
                      gap-x-3 gap-y-6
                      sm:gap-x-4 sm:gap-y-8
                      md:gap-x-[300px] md:gap-y-[80px]
                    "
                  >
                    {cat.products.map((p) => {
                      const discountPrice = (p as any).discountPrice as
                        | number
                        | null
                        | undefined;

                      // ✅ если discountPrice валиден — пересчитываем процент из цен
                      // чтобы ProductCard (если он считает цену по percent) показал ровно discountPrice
                      const percent = isValidDiscount(p.price, discountPrice)
                        ? calcPercentFromPrices(p.price, Number(discountPrice))
                        : (p.discountPercent ?? 0);

                      return (
                        <ProductCard
                          key={p.id}
                          slug={p.slug}
                          title={p.title}
                          price={p.price} // ✅ базовая цена (как ожидает ProductCard)
                          imageUrl={p.images?.[0] ?? null}
                          isSoon={p.isSoon}
                          discountPercent={percent} // ✅ процент подогнан под discountPrice
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}