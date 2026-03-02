import { prisma } from "@/lib/prisma";
import HeroBanner from "@/components/HeroBanner";
import ProductCard from "@/components/ProductCard";

export const metadata = {
  title: "SATL | официальный интернет-магазин",
  description:
    "Интернет-магазин одежды SATL. Новые коллекции, лимитированные релизы.",
};

// ✅ проверка валидности скидочной цены
function isValidDiscount(basePrice: number, discountPrice?: number | null) {
  const base = Number(basePrice ?? 0);
  const disc = discountPrice == null ? null : Number(discountPrice);
  return Boolean(base && disc && disc > 0 && disc < base);
}

// ✅ процент скидки ТОЛЬКО для плашки (без округлений)
// мы не пытаемся сделать его математически точным — просто показываем,
// а цену берём из payPrice (discountPrice)
function calcDisplayPercent(basePrice: number, discountPrice: number) {
  const base = Number(basePrice ?? 0);
  const disc = Number(discountPrice ?? 0);
  if (!base || !disc || disc <= 0 || disc >= base) return 0;

  // ВАЖНО: без округлений "вообще" целого процента не бывает,
  // но для UI плашки берём "как есть" и отрезаем дробь,
  // чтобы не было прыжков/round.
  const raw = ((base - disc) * 100) / base;

  // например 19.9% => 19%
  const pct = Math.floor(raw);

  if (pct < 1) return 1;
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

                      const base = Number(p.price ?? 0);

                      const hasDiscount = isValidDiscount(base, discountPrice);
                      const disc = hasDiscount ? Number(discountPrice) : null;

                      // ✅ цена к оплате — строго discountPrice, если он валидный
                      const payPrice = hasDiscount && disc != null ? disc : base;

                      // ✅ процент скидки — только чтобы карточка показала плашку/старую цену
                      const displayPercent =
                        hasDiscount && disc != null
                          ? calcDisplayPercent(base, disc)
                          : 0;

                      return (
                        <ProductCard
                          key={p.id}
                          slug={p.slug}
                          title={p.title}
                          price={payPrice} // ✅ итоговая цена (discountPrice) без пересчётов
                          imageUrl={p.images?.[0] ?? null}
                          isSoon={p.isSoon}
                          discountPercent={displayPercent} // ✅ чтобы не пропадала плашка/старая цена
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