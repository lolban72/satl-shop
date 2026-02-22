import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

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

function makeSku(slug: string, size: string, color: string) {
  return `${slug}-${size}-${color}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 8)}`.toUpperCase();
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  // ✅ защита админского API
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json();

  const imagesFinal =
    body.homeImage || body.images
      ? ([body.homeImage, ...(body.images ?? [])].filter(Boolean) as string[])
      : undefined;

  const price =
    body.priceRub !== undefined
      ? Math.round(Number(body.priceRub) * 100)
      : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.product.update({
      where: { id },
      data: {
        title: body.title ?? undefined,
        slug: body.slug ?? undefined,
        description: body.description ?? undefined,
        categoryId: body.categoryId === undefined ? undefined : body.categoryId,

        images: imagesFinal,

        isSoon: body.isSoon ?? undefined,

        price: body.isSoon === true ? 0 : price ?? undefined,

        discountPercent:
          body.isSoon === true ? 0 : body.discountPercent ?? undefined,

        // ✅ NEW: размерная таблица (картинка)
        // Если поле не прислали — не трогаем (undefined)
        // Если прислали null — очищаем
        sizeChartImage:
          body.sizeChartImage === undefined ? undefined : body.sizeChartImage,
      },
    });

    if (body.variants) {
      await tx.variant.deleteMany({ where: { productId: id } });

      const variants = body.variants.map((v: any) => ({
        productId: id,
        sku: makeSku(p.slug, v.size, v.color ?? "default"),
        size: v.size,
        color: v.color ?? "default",
        stock: v.stock,
      }));

      // на всякий случай — если пришёл пустой массив, просто не создаём
      if (variants.length) {
        await tx.variant.createMany({ data: variants });
      }
    }

    return p;
  });

  revalidatePath("/");
  revalidatePath(`/product/${updated.slug}`);
  revalidatePath("/admin/products");

  return NextResponse.json({ ok: true });
}