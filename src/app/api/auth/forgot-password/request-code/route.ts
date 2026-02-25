import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { tgSendMessage } from "@/lib/tg";

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function gen6() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 цифр
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email) return Response.json({ error: "Email обязателен" }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, tgChatId: true },
    });

    // ✅ не раскрываем, существует ли пользователь / привязан ли TG
    if (!user?.tgChatId) return Response.json({ ok: true }, { status: 200 });

    const code = gen6();
    // ✅ соль = userId, чтобы codeHash был уникален глобально
    const codeHash = sha256(`${user.id}:${code}`);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут

    // на всякий — чистим старые/неиспользованные (не обязательно, но полезно)
    await prisma.passwordResetCode.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    await prisma.passwordResetCode.create({
      data: { userId: user.id, codeHash, expiresAt },
    });

    await tgSendMessage(
      user.tgChatId,
      `Код для восстановления пароля: <b>${code}</b>\n\nЕсли это не вы — просто игнорируйте.`
    );

    return Response.json({ ok: true }, { status: 200 });
  } catch {
    // специально без деталей
    return Response.json({ ok: true }, { status: 200 });
  }
}