import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || !password || password.length < 6) {
      return Response.json({ error: "Некорректные данные" }, { status: 400 });
    }

    const tokenHash = sha256(token);

    const row = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (
      !row ||
      row.usedAt ||
      row.expiresAt < new Date()
    ) {
      return Response.json({ error: "Ссылка недействительна" }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { password: hash },
      }),
      prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return Response.json({ ok: true });

  } catch {
    return Response.json({ error: "Ошибка" }, { status: 400 });
  }
}