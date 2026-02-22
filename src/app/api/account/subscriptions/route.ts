import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

async function tgSend(chatId: string, text: string) {
  const token = process.env.TG_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {});
}

export async function PATCH(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const next = Boolean(body?.newsletterEnabled);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tgChatId: true },
  });

  if (next && !user?.tgChatId) {
    return NextResponse.json(
      { error: "Telegram не привязан. Сначала привяжите Telegram-аккаунт." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { newsletterEnabled: next },
  });

  // ✅ опционально: тестовое сообщение при включении
  if (next && user?.tgChatId) {
    await tgSend(user.tgChatId, "✅ Вы подписались на рассылку SATL. Теперь вы будете получать новости и скидки.");
  }

  return NextResponse.json({ ok: true });
}