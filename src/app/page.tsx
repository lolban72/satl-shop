import { prisma } from "@/lib/prisma";
import HeroBanner from "@/components/HeroBanner";
import ProductCard from "@/components/ProductCard";

export const metadata = {
  title: "SATL | официальный интернет-магазин",
  description:
    "Интернет-магазин одежды SATL. Новые коллекции, лимитированные релизы.",
};

// 🔥 Округление до ...90
function calcDiscountedPrice(price: number, discountPercent?: number | null) {
  const p = Number(price ?? 0);
  const d = Number(discountPercent ?? 0);

  if (!p || !d || d <= 0 || d >= 100) return p;

  // 1️⃣ цена со скидкой
  const discounted = p * (1 - d / 100);

  // 2️⃣ в рубли
  const rub = discounted / 100;

  // 3️⃣ округляем вверх до десятков
  const roundedToTen = Math.ceil(rub / 10) * 10;

  // 4️⃣ делаем окончание 90
  const finalRub = roundedToTen - 10 + 90;

  return finalRub * 100; // обратно в копейки
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
          price: true,
          images: true,
          isSoon: true,
          discountPercent: true,
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
          <p className="mt-4 text-gray-600">
            Пока нет категорий с товарами.
          </p>
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
                      const discountedPrice = calcDiscountedPrice(
                        p.price,
                        p.discountPercent
                      );

                      return (
                        <ProductCard
                          key={p.id}
                          slug={p.slug}
                          title={p.title}
                          price={discountedPrice} // ✅ цена со скидкой и округлением ...90
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