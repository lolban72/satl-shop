import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const UpdateSchema = z.object({
  isActive: z.coerce.boolean().optional(),
});

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (role !== "admin") {
    throw new Error("FORBIDDEN");
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = UpdateSchema.parse(await req.json());

    const promo = await prisma.promoCode.update({
      where: { id },
      data: {
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });

    return Response.json({ promo });
  } catch (e: any) {
    const msg = e?.issues?.[0]?.message || e?.message || "Ошибка обновления промокода";
    return Response.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params;

    await prisma.promoCode.delete({
      where: { id },
    });

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: "Ошибка удаления промокода" }, { status: 400 });
  }
}