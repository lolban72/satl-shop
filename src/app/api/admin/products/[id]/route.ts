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

function rubToCentsOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;

  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) return null;

  const cents = Math.round(n * 100);
  if (!Number.isFinite(cents) || cents <= 0) return null;

  return cents;
}

function toIntOrUndefined(v: any): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

async function readBody(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await req.json();
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await req.formData();
    const obj: Record<string, any> = {};
    for (const [key, value] of formData.entries()) {
      obj[key] = value;
    }
    return obj;
  }

  return {};
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await readBody(req);

  const imagesFinal =
    body.homeImage || body.images
      ? ([body.homeImage, ...(body.images ?? [])].filter(Boolean) as string[])
      : undefined;

  const priceCents =
    body.priceRub === undefined ? undefined : rubToCentsOrNull(body.priceRub);

  const discountPriceCents =
    body.discountPriceRub === undefined
      ? undefined
      : rubToCentsOrNull(body.discountPriceRub);

  const sortOrder = toIntOrUndefined(body.sortOrder);

  if (body.isSoon !== true) {
    if (body.priceRub !== undefined && priceCents == null) {
      return NextResponse.json(
        { error: "Некорректная цена (без скидки)" },
        { status: 400 }
      );
    }

    const nextPrice =
      body.priceRub === undefined ? null : (priceCents as number | null);

    const nextDiscountPrice =
      body.discountPriceRub === undefined
        ? null
        : (discountPriceCents as number | null);

    if (
      nextPrice != null &&
      nextPrice > 0 &&
      nextDiscountPrice != null &&
      nextDiscountPrice >= nextPrice
    ) {
      return NextResponse.json(
        { error: "Цена со скидкой должна быть меньше обычной цены" },
        { status: 400 }
      );
    }
  }

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

        price:
          body.isSoon === true
            ? 0
            : priceCents === undefined
            ? undefined
            : (priceCents ?? undefined),

        discountPercent:
          body.isSoon === true ? 0 : body.discountPercent ?? undefined,

        discountPrice:
          body.isSoon === true
            ? null
            : discountPriceCents === undefined
            ? undefined
            : discountPriceCents,

        sizeChartImage:
          body.sizeChartImage === undefined ? undefined : body.sizeChartImage,

        sortOrder,
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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const formData = await req.formData();
  const method = String(formData.get("_method") || "").toUpperCase();

  if (method === "PATCH") {
    return PATCH(
      new Request(req.url, {
        method: "PATCH",
        headers: req.headers,
        body: new URLSearchParams(
          Array.from(formData.entries()).map(([k, v]) => [k, String(v)])
        ),
      }),
      ctx
    );
  }

  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      await tx.variant.deleteMany({ where: { productId: id } });
      return tx.product.delete({ where: { id } });
    });

    revalidatePath("/");
    revalidatePath(`/product/${deleted.slug}`);
    revalidatePath("/admin/products");

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Delete failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}