import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { isAllowedTransition, STATUS_ORDER, type OrderStatus } from "@/lib/order-status";

function parseAdminEmails(v?: string) {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
function isAdminEmail(email?: string | null) {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  return parseAdminEmails(process.env.ADMIN_EMAILS).includes(e);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const next = String(body?.status ?? "").toUpperCase() as OrderStatus;

  // ✅ проверяем что статус вообще существует
  if (!STATUS_ORDER.includes(next)) {
    return NextResponse.json({ error: "Некорректный статус" }, { status: 400 });
  }

  // ✅ узнаём текущий статус
  const current = await prisma.order.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!current) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  const from = current.status as OrderStatus;

  // ✅ запрещаем нелогичные переходы
  if (!isAllowedTransition(from, next)) {
    return NextResponse.json(
      { error: `Нельзя сменить статус: ${from} → ${next}` },
      { status: 400 }
    );
  }

  await prisma.order.update({
    where: { id },
    data: { status: next },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);

  return NextResponse.json({ ok: true });
}