import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

function parseAdminEmails(v?: string) {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email?: string | null) {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  const admins = parseAdminEmails(process.env.ADMIN_EMAILS);
  return admins.includes(e);
}

const VariantSchema = z.object({
  size: z.string().min(1),
  color: z.string().optional(),
  stock: z.number().int().min(0),
});

// аккуратно переводим "рубли строкой" -> "копейки int"
function rubToCentsOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;

  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) return null;

  const cents = Math.round(n * 100);
  if (!Number.isFinite(cents) || cents < 0) return null;

  return cents;
}

const BaseSchema = z.object({
  title: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional(),

  // ✅ делаем optional — дальше валидируем условиями
  homeImage: z.string().optional(),
  images: z.array(z.string()).optional(),

  // цена без скидки (обязательна для НЕ soon)
  priceRub: z.string().optional(),

  // ✅ НОВОЕ: цена со скидкой (если есть)
  // админка будет отправлять строку рублей, мы на сервере сконвертим в Int копеек
  discountPriceRub: z.string().optional(),

  isSoon: z.boolean().optional(),
  discountPercent: z.number().int().min(0).max(99).optional(),
  categoryId: z.string().nullable().optional(),

  variants: z.array(VariantSchema).optional(),

  // ✅ размерная таблица (картинка)
  sizeChartImage: z.string().nullable().optional(),
});

const Schema = BaseSchema.superRefine((body, ctx) => {
  const isSoon = Boolean(body.isSoon);

  // ===== "СКОРО" =====
  // Требуем хотя бы одну картинку (homeImage или images[0])
  if (isSoon) {
    const hasImage = Boolean(body.homeImage) || Boolean(body.images?.[0]);
    if (!hasImage) {
      ctx.addIssue({
        code: "custom",
        path: ["homeImage"],
        message: "Для режима 'Скоро' нужно загрузить фото",
      });
    }
    return;
  }

  // ===== Обычный товар =====
  if (!body.homeImage) {
    ctx.addIssue({
      code: "custom",
      path: ["homeImage"],
      message: "Фото для карточки обязательно",
    });
  }

  if (!body.images || body.images.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["images"],
      message: "Нужно добавить хотя бы 1 фото",
    });
  }

  if (!body.priceRub) {
    ctx.addIssue({
      code: "custom",
      path: ["priceRub"],
      message: "Цена обязательна",
    });
  }

  // ✅ если указали цену со скидкой — она должна быть корректной
  // (но не обязательна)
  if (body.discountPriceRub != null && String(body.discountPriceRub).trim() !== "") {
    const dp = rubToCentsOrNull(body.discountPriceRub);
    if (dp === null) {
      ctx.addIssue({
        code: "custom",
        path: ["discountPriceRub"],
        message: "Некорректная цена со скидкой",
      });
    }
  }
});

function makeSku(slug: string, size: string, color: string) {
  return `${slug}-${size}-${color}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 8)}`.toUpperCase();
}

export async function POST(req: Request) {
  // ✅ защита админского API
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = Schema.parse(await req.json());
    const isSoon = Boolean(body.isSoon);

    const price = isSoon ? 0 : (rubToCentsOrNull(body.priceRub) ?? 0);

    if (!isSoon && (!Number.isFinite(price) || price <= 0)) {
      return Response.json({ error: "Некорректная цена" }, { status: 400 });
    }

    // ✅ цена со скидкой: null если не задана
    // + защитим от ситуации "скидочная цена больше или равна обычной" (по желанию)
    let discountPrice: number | null = null;
    if (!isSoon) {
      const dp = rubToCentsOrNull(body.discountPriceRub);
      discountPrice = dp && dp > 0 ? dp : null;

      // необязательно, но логично:
      // если ввели скидочную цену, она должна быть меньше обычной
      if (discountPrice !== null && discountPrice >= price) {
        return Response.json(
          { error: "Цена со скидкой должна быть меньше обычной цены" },
          { status: 400 }
        );
      }
    }

    const existing = await prisma.product.findUnique({
      where: { slug: body.slug },
    });

    if (existing) {
      return Response.json({ error: "Slug уже занят" }, { status: 400 });
    }

    // ✅ safe сборка массива картинок (не падает, если images undefined)
    const imagesFinal = [body.homeImage, ...(body.images ?? [])].filter(Boolean) as string[];

    const created = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          title: body.title,
          slug: body.slug,
          description: body.description ?? null,

          // ✅ цена без скидки
          price,

          // ✅ НОВОЕ: цена со скидкой (в копейках)
          // Prisma field: Product.discountPrice Int?
          discountPrice: isSoon ? null : discountPrice,

          images: imagesFinal,
          isSoon,
          discountPercent: isSoon ? 0 : body.discountPercent ?? 0,
          category: body.categoryId ? { connect: { id: body.categoryId } } : undefined,

          // ✅ размерная таблица
          sizeChartImage: body.sizeChartImage ?? null,
        },
      });

      if (isSoon) {
        await tx.variant.create({
          data: {
            productId: p.id,
            sku: makeSku(body.slug, "ONE", "DEFAULT"),
            size: "ONE",
            color: "default",
            stock: 0,
          },
        });
      } else {
        const variants = (body.variants ?? []).map((v) => ({
          productId: p.id,
          sku: makeSku(body.slug, v.size, v.color ?? "default"),
          size: v.size,
          color: v.color ?? "default",
          stock: v.stock,
        }));

        if (variants.length) {
          await tx.variant.createMany({ data: variants });
        }
      }

      return p;
    });

    return Response.json({ ok: true, slug: created.slug });
  } catch (e: any) {
    return Response.json(
      { error: e?.issues?.[0]?.message || e?.message || "Ошибка" },
      { status: 400 }
    );
  }
}