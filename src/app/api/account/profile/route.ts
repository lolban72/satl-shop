import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const Schema = z.object({
  name: z.string().optional(),
  lastName: z.string().optional(), // ✅
  phone: z.string().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) {
      return Response.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = Schema.parse(await req.json());

    await prisma.user.update({
      where: { id: userId },
      data: {
        name: (body.name ?? "").trim() || null,
        lastName: (body.lastName ?? "").trim() || null, // ✅
        phone: (body.phone ?? "").trim() || null,
      },
    });

    return Response.json({ ok: true });
  } catch (e: any) {
    const msg = e?.issues?.[0]?.message || e?.message || "Не удалось сохранить";
    return Response.json({ error: msg }, { status: 400 });
  }
}