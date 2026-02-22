import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache"; // ✅ ДОБАВЬ

function parseAdminEmails(v?: string) {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email?: string | null) {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  const admins = parseAdminEmails(process.env.ADMIN_EMAILS);
  return admins.includes(e);
}

async function getOrCreate() {
  let row = await prisma.marqueeSettings.findFirst();
  if (!row) {
    row = await prisma.marqueeSettings.create({
      data: { text: "СКИДКИ 20%", speedSeconds: 10, enabled: true },
    });
  }
  return row;
}

export async function GET() {
  // ✅ защита админского API
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await getOrCreate();
  return NextResponse.json(row);
}

export async function PATCH(req: Request) {
  // ✅ защита админского API
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  const text = typeof body.text === "string" ? body.text.trim() : undefined;
  const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;

  const speedRaw =
    typeof body.speedSeconds === "number"
      ? body.speedSeconds
      : typeof body.speedSeconds === "string"
      ? Number(body.speedSeconds)
      : undefined;

  const speedSeconds =
    speedRaw === undefined ? undefined : Math.max(5, Math.floor(speedRaw));

  if (text !== undefined && text.length < 1) {
    return NextResponse.json(
      { error: "Текст не может быть пустым" },
      { status: 400 }
    );
  }

  const current = await getOrCreate();

  const updated = await prisma.marqueeSettings.update({
    where: { id: current.id },
    data: {
      text: text ?? undefined,
      enabled: enabled ?? undefined,
      speedSeconds: speedSeconds ?? undefined,
    },
  });

  // ✅ ВАЖНО: сброс кэша страниц/лейаута
  revalidatePath("/");
  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true, settings: updated });
}