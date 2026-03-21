import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const CreatePromoSchema = z.object({
  code: z.string().trim().min(2),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.coerce.number().int().positive(),
  minOrderTotal: z.coerce.number().int().min(0).optional().nullable(),
  maxUses: z.coerce.number().int().min(1).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.coerce.boolean().optional(),
});

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (role !== "admin") {
    throw new Error("FORBIDDEN");
  }
}

export async function GET() {
  try {
    await requireAdmin();

    const promos = await prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ promos });
  } catch (e: any) {
    return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = CreatePromoSchema.parse(await req.json());

    const promo = await prisma.promoCode.create({
      data: {
        code: body.code.toUpperCase(),
        discountType: body.discountType,
        discountValue: body.discountValue,
        minOrderTotal: body.minOrderTotal ?? null,
        maxUses: body.maxUses ?? null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        isActive: body.isActive ?? true,
      },
    });

    return Response.json({ promo });
  } catch (e: any) {
    const msg = e?.issues?.[0]?.message || e?.message || "Ошибка создания промокода";

    return Response.json({ error: msg }, { status: 400 });
  }
}