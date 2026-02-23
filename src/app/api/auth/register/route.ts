import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(), // ✅ ДОБАВИЛИ
  phone: z.string().min(5).optional(), // ✅
});

export async function POST(req: Request) {
  try {
    const body = Schema.parse(await req.json());
    const email = body.email.toLowerCase().trim();

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return Response.json(
        { error: "Пользователь уже существует" },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hash,
        name: body.name?.trim() || null,
        lastName: body.lastName?.trim() || null, // ✅
        phone: body.phone?.trim() || null, // ✅
      },
      select: { id: true, email: true, name: true, lastName: true, phone: true },
    });

    return Response.json({ ok: true, user });
  } catch (e: any) {
    const msg = e?.issues?.[0]?.message || e?.message || "Ошибка регистрации";
    return Response.json({ error: msg }, { status: 400 });
  }
}