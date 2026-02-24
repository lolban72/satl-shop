import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return Response.json({ error: "Введите email" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Никогда не раскрываем, существует ли пользователь
    if (!user) {
      return Response.json({ ok: true });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(rawToken);

    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 минут

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // ⚠️ Пока возвращаем ссылку прямо в ответе (для теста)
    return Response.json({
      ok: true,
      resetUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password?token=${rawToken}`,
    });

  } catch {
    return Response.json({ error: "Ошибка" }, { status: 400 });
  }
}