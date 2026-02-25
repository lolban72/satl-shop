import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const code = String(body?.code || "").trim();
    const password = String(body?.password || "");

    if (!email || !code || !password) {
      return Response.json({ error: "Заполните все поля" }, { status: 400 });
    }
    if (password.length < 6) {
      return Response.json({ error: "Пароль должен быть не короче 6 символов" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    // ✅ опять же не раскрываем, существует ли пользователь
    if (!user) return Response.json({ ok: true }, { status: 200 });

    const codeHash = sha256(`${user.id}:${code}`);

    const rec = await prisma.passwordResetCode.findFirst({
      where: {
        userId: user.id,
        codeHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!rec) {
      return Response.json({ error: "Неверный или просроченный код" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashed },
      }),
      prisma.passwordResetCode.update({
        where: { id: rec.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return Response.json({ ok: true }, { status: 200 });
  } catch {
    return Response.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}