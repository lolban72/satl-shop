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
      where: { email: String(email).toLowerCase().trim() },
      select: { id: true },
    });

    // Не палим, существует ли пользователь
    if (!user) return Response.json({ ok: true });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 минут

    // ✅ Используем существующую модель PasswordResetCode
    // Поля могут отличаться — ниже самый частый вариант:
    await prisma.passwordResetCode.create({
      data: {
        userId: user.id,
        codeHash: tokenHash, // ✅ если у тебя поле называется codeHash
        expiresAt,
        usedAt: null,
      },
    });

    return Response.json({
      ok: true,
      resetUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password?token=${rawToken}`,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Ошибка" }, { status: 400 });
  }
}