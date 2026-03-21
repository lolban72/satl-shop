import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const CreatePromoSchema = z.object({
  code: z.string().trim().min(2, "Введите код промокода"),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.coerce.number().int().positive("Скидка должна быть больше 0"),
  minOrderTotal: z.coerce.number().int().min(0).nullable().optional(),
  maxUses: z.coerce.number().int().min(1).nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  isActive: z.coerce.boolean().optional(),
});

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

async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
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
        code: body.code.trim().toUpperCase(),
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
    if (e?.message === "FORBIDDEN") {
      return Response.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const msg =
      e?.issues?.[0]?.message ||
      e?.message ||
      "Ошибка создания промокода";

    return Response.json({ error: msg }, { status: 400 });
  }
}