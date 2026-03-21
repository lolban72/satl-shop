import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const UpdateSchema = z.object({
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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await context.params;
    const body = UpdateSchema.parse(await req.json());

    const promo = await prisma.promoCode.update({
      where: { id },
      data: {
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
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
      "Ошибка обновления промокода";

    return Response.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await context.params;

    await prisma.$transaction(async (tx) => {
      await tx.paymentDraft.updateMany({
        where: { promoCodeId: id },
        data: {
          promoCodeId: null,
          promoCode: null,
        },
      });

      await tx.promoCode.delete({
        where: { id },
      });
    });

    return Response.json({ ok: true });
  } catch (e: any) {
    if (e?.message === "FORBIDDEN") {
      return Response.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    return Response.json(
      { error: e?.message || "Ошибка удаления промокода" },
      { status: 400 }
    );
  }
}