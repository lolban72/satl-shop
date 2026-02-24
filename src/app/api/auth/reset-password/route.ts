import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || !password || String(password).length < 6) {
      return Response.json({ error: "Некорректные данные" }, { status: 400 });
    }

    const tokenHash = sha256(String(token));

    // ✅ ищем по codeHash (если у тебя так называется поле)
    const row = await prisma.passwordResetCode.findFirst({
      where: {
        codeHash: tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true },
    });

    if (!row) {
      return Response.json({ error: "Ссылка недействительна" }, { status: 400 });
    }

    const hash = await bcrypt.hash(String(password), 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { password: hash },
      }),
      prisma.passwordResetCode.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Ошибка" }, { status: 400 });
  }
}