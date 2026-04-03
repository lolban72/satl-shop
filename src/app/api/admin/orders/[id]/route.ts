import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import {
  isAllowedTransition,
  STATUS_ORDER,
  type OrderStatus,
} from "@/lib/order-status";
import { tgSendMessage } from "@/lib/tg";

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

function statusLabel(s: OrderStatus) {
  if (s === "SHIPPED") return "В доставке 🚚";
  if (s === "DELIVERED") return "Доставлен ✅";
  if (s === "RETURNED") return "Возврат ↩️";
  return s;
}

async function notifyClientStatus(params: {
  userId: string | null;
  orderId: string;
  status: OrderStatus;
  trackNumber?: string | null;
}) {
  if (!params.userId) return;

  const u = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { tgChatId: true },
  });

  if (!u?.tgChatId) return;

  const trackLine = params.trackNumber
    ? `\nТрек номер: <code>${params.trackNumber}</code>`
    : "";

  const text =
    `<b>Статус заказа изменён</b>\n` +
    `Заказ: <code>${params.orderId}</code>\n` +
    `Статус: <b>${statusLabel(params.status)}</b>` +
    `${trackLine}\n\n` +
    `Отслеживание: <a href="https://satl.shop/account/orders" target="_blank">Мои заказы</a>`;

  await tgSendMessage(u.tgChatId, text).catch(() => {});
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const next = String(body?.status ?? "").toUpperCase() as OrderStatus;

    if (!STATUS_ORDER.includes(next)) {
      return NextResponse.json(
        { error: "Некорректный статус" },
        { status: 400 }
      );
    }

    const current = await prisma.order.findUnique({
      where: { id },
      select: {
        status: true,
        userId: true,
        trackNumber: true,
      },
    });

    if (!current) {
      return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    }

    const from = current.status as OrderStatus;

    if (from === next) {
      return NextResponse.json({ ok: true, changed: false });
    }

    if (!isAllowedTransition(from, next)) {
      return NextResponse.json(
        { error: `Нельзя сменить статус: ${from} → ${next}` },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (next === "RETURNED" && from !== "RETURNED") {
        const orderWithItems = await tx.order.findUnique({
          where: { id },
          select: {
            items: {
              select: {
                variantId: true,
                quantity: true,
              },
            },
          },
        });

        if (!orderWithItems) {
          throw new Error("Заказ не найден");
        }

        for (const item of orderWithItems.items) {
          if (!item.variantId) continue;

          await tx.variant.update({
            where: { id: item.variantId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }
      }

      return tx.order.update({
        where: { id },
        data: { status: next },
        select: {
          id: true,
          status: true,
          userId: true,
          trackNumber: true,
        },
      });
    });

    if (next === "SHIPPED" || next === "DELIVERED" || next === "RETURNED") {
      await notifyClientStatus({
        userId: updated.userId ?? null,
        orderId: updated.id,
        status: next,
        trackNumber: updated.trackNumber ?? null,
      });
    }

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${id}`);
    revalidatePath("/account/orders");

    return NextResponse.json({ ok: true, changed: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Ошибка при обновлении статуса заказа" },
      { status: 400 }
    );
  }
}