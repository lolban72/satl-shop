import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).optional(),
});

export async function POST(req: Request) {
  try {
    const body = Schema.parse(await req.json());
    const email = body.email.toLowerCase().trim();

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return Response.json({ error: "Пользователь уже существует" }, { status: 400 });
    }

    const hash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hash,
        name: body.name ?? null,
      },
      select: { id: true, email: true, name: true },
    });

    return Response.json({ ok: true, user });
  } catch (e: any) {
    const msg = e?.issues?.[0]?.message || e?.message || "Ошибка регистрации";
    return Response.json({ error: msg }, { status: 400 });
  }
}
