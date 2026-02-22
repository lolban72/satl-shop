import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? null;

  if (!userId || !userEmail) {
    return NextResponse.json(
      { error: "Нужно войти в аккаунт, чтобы подписка отразилась в личном кабинете." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return NextResponse.json({ error: "Введите E-mail" }, { status: 400 });
  }

  // ✅ защита: подписывать можно только свой email
  if (email !== String(userEmail).trim().toLowerCase()) {
    return NextResponse.json(
      { error: "Email должен совпадать с email вашего аккаунта." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { newsletterEnabled: true },
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
}
