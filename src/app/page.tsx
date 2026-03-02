import { prisma } from "@/lib/prisma";
import HeroBanner from "@/components/HeroBanner";
import ProductCard from "@/components/ProductCard";

export const metadata = {
  title: "SATL | официальный интернет-магазин",
  description:
    "Интернет-магазин одежды SATL. Новые коллекции, лимитированные релизы.",
};

// ✅ цена к оплате: если discountPrice задана — используем её, иначе обычная price
function calcPayPrice(basePrice: number, discountPrice?: number | null) {
  const base = Number(basePrice ?? 0);
  const disc = discountPrice == null ? null : Number(discountPrice);

  if (disc && disc > 0 && disc < base) return disc;
  return base;
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
        select: {
          id: true,
          slug: true,
          title: true,

          // ✅ price = базовая цена (без скидки)
          price: true,

          // ✅ discountPrice = цена со скидкой (если есть)
          // ⚠️ ВАЖНО: это поле должно реально существовать в Prisma schema,
          // и на сервере должен быть сделан `npx prisma generate`
          discountPrice: true,

          images: true,
          isSoon: true,
          discountPercent: true, // можно оставить
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
                      const payPrice = calcPayPrice(p.price, p.discountPrice);

                      return (
                        <ProductCard
                          key={p.id}
                          slug={p.slug}
                          title={p.title}
                          price={payPrice} // ✅ цена к оплате
                          imageUrl={p.images?.[0] ?? null}
                          isSoon={p.isSoon}
                          discountPercent={p.discountPercent ?? 0}
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