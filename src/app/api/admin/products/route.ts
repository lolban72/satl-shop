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

const BaseSchema = z.object({
  title: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional(),

  // ✅ делаем optional — дальше валидируем условиями
  homeImage: z.string().optional(),
  images: z.array(z.string()).optional(),

  priceRub: z.string().optional(),
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

  // variants опциональны — но если пришли, то минимум 1 вариант (по желанию)
  // Если хочешь требовать варианты всегда для не-soon — раскомментируй:
  // if (!body.variants || body.variants.length === 0) {
  //   ctx.addIssue({ code: "custom", path: ["variants"], message: "Нужно добавить хотя бы 1 вариант" });
  // }
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

    const price = isSoon ? 0 : Math.round(Number(body.priceRub ?? 0) * 100);

    if (!isSoon && (!Number.isFinite(price) || price <= 0)) {
      return Response.json({ error: "Некорректная цена" }, { status: 400 });
    }

    const existing = await prisma.product.findUnique({
      where: { slug: body.slug },
    });

    if (existing) {
      return Response.json({ error: "Slug уже занят" }, { status: 400 });
    }

    // ✅ safe сборка массива картинок (не падает, если images undefined)
    const imagesFinal = [body.homeImage, ...(body.images ?? [])].filter(
      Boolean
    ) as string[];

    const created = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          title: body.title,
          slug: body.slug,
          description: body.description ?? null,
          price,
          images: imagesFinal,
          isSoon,
          discountPercent: isSoon ? 0 : body.discountPercent ?? 0,
          category: body.categoryId
            ? { connect: { id: body.categoryId } }
            : undefined,

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