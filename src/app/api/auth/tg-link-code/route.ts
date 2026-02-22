import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function makeCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без 0/O/1/I
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[crypto.randomInt(0, alphabet.length)];
  return s;
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = makeCode(6);
  const codeHash = sha256(code);

  // убираем старые активные коды пользователя
  await prisma.tgLinkCode.deleteMany({
    where: { userId, usedAt: null },
  });

  await prisma.tgLinkCode.create({
    data: {
      userId,
      codeHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 минут
    },
  });

  return NextResponse.json({
    code,
    expiresInSeconds: 600,
  });
}