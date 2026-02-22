import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function CategoriesDropdown() {
  const categories = await prisma.category.findMany({
    where: { showInNav: true },
    orderBy: { navOrder: "asc" },
    select: { id: true, title: true, slug: true },
  });

  if (categories.length === 0) return null;

  return (
    <div className="relative group">
      {/* Кнопка */}
      <Link
        href="/catalog"
        className="px-3 py-2 rounded-xl hover:bg-white/10 transition"
      >
        Категории
      </Link>

      {/* Выпадашка */}
      <div
        className="
          absolute left-0 top-full z-50 mt-2 w-[260px]
          opacity-0 translate-y-1 pointer-events-none
          group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto
          group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:pointer-events-auto
          transition
        "
      >
        <div className="rounded-2xl border border-white/20 bg-black/60 backdrop-blur-xl shadow-2xl p-2">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/category/${c.slug}`}
              className="block rounded-xl px-3 py-2 text-sm hover:bg-white/10 transition"
            >
              {c.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
