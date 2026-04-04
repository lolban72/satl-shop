import { prisma } from "@/lib/prisma";
import { tgSendMessage, parseChatIds } from "@/lib/tg";
import { getCdekClient } from "@/lib/cdek-client";
import { buildPackageFromItemsCount } from "@/lib/cdek-package";

const CDEK_ENV = String(process.env.CDEK_ENV ?? "TEST").toUpperCase();
const CDEK_BASE_URL =
  CDEK_ENV === "PROD"
    ? "https://api.cdek.ru/v2"
    : "https://api.edu.cdek.ru/v2";

const CDEK_WAREHOUSE_WAREHOUSE_TARIFF = 136;

type DraftItem = {
  productId?: string;
  variantId?: string | null;
  qty?: number;
  quantity?: number;
  title?: string;
  price?: number;
};

function b64urlDecodeToString(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  return Buffer.from(s, "base64").toString("utf8");
}

function rubFromCents(cents: number) {
  return `${((cents ?? 0) / 100).toFixed(0)}р`;
}

function statusLabel(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "SHIPPED") return "В доставке 🚚";
  if (s === "READY_FOR_PICKUP") return "Готов к выдаче 📦";
  if (s === "DELIVERED") return "Доставлен ✅";
  return s;
}

function normalizePhone(phone: string) {
  const raw = String(phone ?? "").trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  return `+${digits}`;
}

function extractCdekError(err: any) {
  return {
    message: err?.message || "CDEK request failed",
    response: err?.response ?? null,
    data: err?.data ?? null,
    body: err?.body ?? null,
    errors: err?.errors ?? null,
    cause: err?.cause ?? null,
    stack: err?.stack ?? null,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getEntity(raw: any) {
  if (
    raw?.entity &&
    typeof raw.entity === "object" &&
    !Array.isArray(raw.entity)
  ) {
    return raw.entity;
  }

  if (Array.isArray(raw?.entity) && raw.entity.length > 0) {
    return raw.entity[0];
  }

  if (Array.isArray(raw?.entities) && raw.entities.length > 0) {
    return raw.entities[0];
  }

  return null;
}

function buildOrderPackage(items: DraftItem[]) {
  const itemsCount = Math.max(
    1,
    items.reduce((sum, it) => {
      const qty = Number(it?.qty ?? it?.quantity ?? 1);
      return sum + (Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 1);
    }, 0)
  );

  const { totalWeightGr, pack } = buildPackageFromItemsCount(itemsCount);

  const firstTitle =
    String(items?.[0]?.title ?? "SATL item").trim() || "SATL item";

  const itemName = itemsCount > 1 ? `${firstTitle} и др.` : firstTitle;

  return {
    itemsCount,
    totalWeightGr,
    itemName,
    pack,
  };
}

async function getCdekAccessToken() {
  const clientId = process.env.CDEK_CLIENT_ID;
  const clientSecret = process.env.CDEK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("CDEK_CLIENT_ID/CDEK_CLIENT_SECRET не заданы");
  }

  const form = new URLSearchParams();
  form.set("grant_type", "client_credentials");
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);

  const res = await fetch(`${CDEK_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    cache: "no-store",
  });

  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`CDEK auth failed: ${res.status} ${JSON.stringify(data)}`);
  }

  const accessToken = String(data?.access_token ?? "").trim();
  if (!accessToken) {
    throw new Error(`CDEK auth: access_token not returned: ${text}`);
  }

  return accessToken;
}

async function fetchCdekOrderByUuid(uuid: string) {
  const token = await getCdekAccessToken();

  const res = await fetch(
    `${CDEK_BASE_URL}/orders/${encodeURIComponent(uuid)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(
      `CDEK get order failed: ${res.status} ${JSON.stringify(data)}`
    );
  }

  return data;
}

async function enrichCdekOrderAfterCreate(params: {
  uuid: string | null;
  cdekNumber: string | null;
}) {
  if (!params.uuid) {
    return {
      uuid: null,
      cdekNumber: params.cdekNumber ?? null,
      raw: null,
    };
  }

  if (params.cdekNumber) {
    return {
      uuid: params.uuid,
      cdekNumber: params.cdekNumber,
      raw: null,
    };
  }

  await sleep(3000);

  try {
    const raw = await fetchCdekOrderByUuid(params.uuid);
    const entity = getEntity(raw);
    const cdekNumber = String(
      entity?.cdek_number ?? entity?.number ?? ""
    ).trim();

    return {
      uuid: params.uuid,
      cdekNumber: cdekNumber || null,
      raw,
    };
  } catch (e) {
    console.log(
      "⚠️ CDEK delayed fetch after create failed:",
      JSON.stringify(extractCdekError(e), null, 2)
    );

    return {
      uuid: params.uuid,
      cdekNumber: null,
      raw: null,
    };
  }
}

async function registerCdekOrder(params: {
  orderId: string;
  recipientName: string;
  recipientPhone: string;
  pvzCode: string;
  items: DraftItem[];
}) {
  const fromPvz = String(process.env.CDEK_FROM_PVZ_CODE ?? "").trim();

  if (!fromPvz) {
    throw new Error("CDEK_FROM_PVZ_CODE env required");
  }

  if (!params.pvzCode || !String(params.pvzCode).trim()) {
    throw new Error("CDEK pvzCode is missing");
  }

  const client = getCdekClient();

  const { itemName, pack } = buildOrderPackage(params.items);

  const payload = {
    type: 1,
    number: params.orderId,
    tariff_code: CDEK_WAREHOUSE_WAREHOUSE_TARIFF,
    recipient: {
      name: params.recipientName,
      phones: [{ number: normalizePhone(params.recipientPhone) }],
    },
    shipment_point: fromPvz,
    delivery_point: params.pvzCode,
    packages: [
      {
        number: `PKG-${params.orderId}`,
        weight: pack.weight,
        length: pack.length,
        width: pack.width,
        height: pack.height,
        items: [
          {
            name: itemName,
            ware_key: `ORDER-${params.orderId}`,
            payment: { value: 0 },
            cost: 1000,
            amount: 1,
            weight: pack.weight,
          },
        ],
      },
    ],
  };

  console.log(
    "[CDEK_WEBHOOK] register payload:",
    JSON.stringify(payload, null, 2)
  );

  try {
    const created = await client.addOrder(payload);

    console.log(
      "[CDEK_WEBHOOK] register success:",
      JSON.stringify(created, null, 2)
    );

    const entity = (created as any)?.entity ?? null;
    const uuid = String(entity?.uuid ?? "").trim() || null;
    const cdekNumber = String(entity?.cdek_number ?? "").trim() || null;

    const enriched = await enrichCdekOrderAfterCreate({
      uuid,
      cdekNumber,
    });

    return {
      uuid: enriched.uuid,
      cdekNumber: enriched.cdekNumber,
      package: {
        type: pack.packageType,
        weightGr: pack.weight,
        lengthCm: pack.length,
        widthCm: pack.width,
        heightCm: pack.height,
      },
      raw: created,
      lookupRaw: enriched.raw,
    };
  } catch (e: any) {
    console.log(
      "❌ CDEK REGISTER ERROR:",
      JSON.stringify(extractCdekError(e), null, 2)
    );
    throw e;
  }
}

async function notifyUserOrderStatus(params: {
  userId: string | null;
  orderId: string;
  status: string;
  trackNumber?: string | null;
}) {
  if (!params.userId) return;

  const u = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { tgChatId: true },
  });
  if (!u?.tgChatId) return;

  const status = String(params.status || "").toUpperCase();
  const track = params.trackNumber
    ? `\nТрек номер: <code>${params.trackNumber}</code>`
    : "";

  let text = "";

  if (status === "SHIPPED") {
    text =
      `<b>Ваш заказ передан в доставку 🚚</b>\n` +
      `Заказ: <code>${params.orderId}</code>` +
      `${track}\n\n` +
      `Вы можете отслеживать его в личном кабинете:\n` +
      `<a href="https://satl.shop/account/orders" target="_blank">Мои заказы</a>`;
  } else if (status === "READY_FOR_PICKUP") {
    text =
      `<b>Ваш заказ готов к выдаче 📦</b>\n` +
      `Заказ: <code>${params.orderId}</code>` +
      `${track}\n\n` +
      `Проверьте детали в личном кабинете:\n` +
      `<a href="https://satl.shop/account/orders" target="_blank">Мои заказы</a>`;
  } else if (status === "DELIVERED") {
    text =
      `<b>Ваш заказ доставлен ✅</b>\n` +
      `Заказ: <code>${params.orderId}</code>` +
      `${track}\n\n` +
      `Спасибо за покупку 💛`;
  } else {
    text =
      `<b>Статус заказа изменён</b>\n` +
      `Заказ: <code>${params.orderId}</code>\n` +
      `Статус: <b>${statusLabel(status)}</b>` +
      `${track}\n\n` +
      `Ссылка: <a href="https://satl.shop/account/orders" target="_blank">Мои заказы</a>`;
  }

  await tgSendMessage(u.tgChatId, text).catch(() => {});
}

async function handleStatusWebhook(req: Request) {
  const secret = req.headers.get("x-webhook-secret") || "";
  const expected = process.env.ORDER_STATUS_WEBHOOK_SECRET || "";

  if (!expected || secret !== expected) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }

  const orderId = String(body?.orderId ?? "").trim();
  const newStatus = String(body?.status ?? "").trim().toUpperCase();
  const newTrackNumber =
    body?.trackNumber != null ? String(body.trackNumber) : null;

  if (!orderId || !newStatus) {
    return Response.json(
      { ok: false, error: "orderId/status required" },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const prev = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, status: true, trackNumber: true },
    });
    if (!prev) return { ok: false as const, error: "Order not found" };

    const needUpdateTrack =
      newTrackNumber !== null && newTrackNumber !== prev.trackNumber;
    const needUpdateStatus =
      newStatus !== String(prev.status).toUpperCase();

    if (!needUpdateStatus && !needUpdateTrack) {
      return {
        ok: true as const,
        changed: false,
        order: prev,
        prevStatus: prev.status,
        newStatus: prev.status,
      };
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        ...(needUpdateStatus ? { status: newStatus as any } : {}),
        ...(needUpdateTrack ? { trackNumber: newTrackNumber } : {}),
      },
      select: { id: true, userId: true, status: true, trackNumber: true },
    });

    return {
      ok: true as const,
      changed: true,
      order: updated,
      prevStatus: prev.status,
      newStatus: updated.status,
    };
  });

  if (!result.ok) return Response.json(result, { status: 404 });

  const prevS = String((result as any).prevStatus ?? "").toUpperCase();
  const currS = String((result as any).newStatus ?? "").toUpperCase();

  if (
    prevS !== currS &&
    (currS === "SHIPPED" ||
      currS === "READY_FOR_PICKUP" ||
      currS === "DELIVERED")
  ) {
    const order = (result as any).order as {
      id: string;
      userId: string | null;
      status: any;
      trackNumber: string | null;
    };

    await notifyUserOrderStatus({
      userId: order.userId,
      orderId: order.id,
      status: String(order.status),
      trackNumber: order.trackNumber,
    });
  }

  return Response.json({ ok: true, changed: (result as any).changed });
}

async function handleYaPayWebhook(req: Request) {
  const jwt = (await req.text()).trim();

  console.log("✅ YAPAY WEBHOOK HIT");
  console.log("headers:", Object.fromEntries(req.headers.entries()));
  console.log("raw body:", jwt);

  const parts = jwt.split(".");
  if (parts.length !== 3) {
    console.log("❌ Bad JWT format");
    return Response.json({ ok: true });
  }

  const payloadStr = b64urlDecodeToString(parts[1]);
  const payload = JSON.parse(payloadStr);

  const orderId = String(payload?.order?.orderId || "");
  const paymentStatus = String(payload?.order?.paymentStatus || "");

  console.log("✅ YAPAY PAYLOAD:", { orderId, paymentStatus });

  if (!orderId) return Response.json({ ok: true });
  if (paymentStatus !== "CAPTURED") return Response.json({ ok: true });

  const draft = await prisma.paymentDraft.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      email: true,
      name: true,
      phone: true,
      address: true,
      itemsJson: true,
      total: true,
      status: true,
      trackNumber: true,

      pvzCity: true,
      pvzCode: true,
      pvzAddress: true,
      pvzName: true,
      deliveryPrice: true,
      deliveryDays: true,
      tariffCode: true,

      promoCodeId: true,
      promoCode: true,
      discount: true,
    },
  });

  if (!draft) {
    console.log("❌ PaymentDraft not found:", orderId);
    return Response.json({ ok: true });
  }

  const already = await prisma.order.findUnique({
    where: { paymentDraftId: draft.id },
    select: { id: true },
  });

  if (already) {
    await prisma.paymentDraft.update({
      where: { id: draft.id },
      data: { status: "PAID" },
    });

    console.log("ℹ️ Order already exists:", already.id);
    return Response.json({ ok: true });
  }

  const items: DraftItem[] = Array.isArray(draft.itemsJson)
    ? (draft.itemsJson as DraftItem[])
    : [];

  const createdOrder = await prisma.$transaction(async (tx) => {
    await tx.paymentDraft.update({
      where: { id: draft.id },
      data: { status: "PAID" },
    });

    const order = await tx.order.create({
      data: {
        paymentDraftId: draft.id,
        userId: draft.userId ?? null,
        status: "NEW",
        total: draft.total,
        name: draft.name,
        phone: draft.phone,
        address: draft.address,

        pvzCity: draft.pvzCity ?? null,
        pvzCode: draft.pvzCode ?? null,
        pvzAddress: draft.pvzAddress ?? null,
        pvzName: draft.pvzName ?? null,
        deliveryPrice: draft.deliveryPrice ?? null,
        deliveryDays: draft.deliveryDays ?? null,
        tariffCode: draft.pvzCode ? CDEK_WAREHOUSE_WAREHOUSE_TARIFF : draft.tariffCode ?? null,

        trackNumber: draft.trackNumber ?? null,
        items: {
          create: items.map((it: any) => ({
            productId: String(it.productId),
            variantId: it.variantId ? String(it.variantId) : null,
            title: String(it.title ?? ""),
            price: Number(it.price ?? 0),
            quantity: Number(it.qty ?? it.quantity ?? 1),
          })),
        },
      },
      select: {
        id: true,
        userId: true,
        trackNumber: true,
        pvzCode: true,
        name: true,
        phone: true,
        tariffCode: true,
      },
    });

    if (draft.promoCodeId) {
      await tx.promoCode.update({
        where: { id: draft.promoCodeId },
        data: {
          usedCount: {
            increment: 1,
          },
        },
      });
    }

    for (const it of items) {
      const variantId = it?.variantId ? String(it.variantId) : null;
      const qty = Number(it?.qty ?? it?.quantity ?? 1);

      if (!variantId || !Number.isFinite(qty) || qty <= 0) continue;

      const updated = await tx.variant.updateMany({
        where: { id: variantId, stock: { gte: qty } },
        data: { stock: { decrement: qty } },
      });

      if (updated.count === 0) {
        console.log("⚠️ Stock not decremented (not enough):", {
          variantId,
          qty,
        });
      }
    }

    return order;
  });

  let effectiveTrackNumber = createdOrder.trackNumber ?? null;
  let cdekPackageInfo:
    | {
        type: string;
        weightGr: number;
        lengthCm: number;
        widthCm: number;
        heightCm: number;
      }
    | null = null;

  const actualTariffCode = createdOrder.pvzCode
    ? CDEK_WAREHOUSE_WAREHOUSE_TARIFF
    : createdOrder.tariffCode ?? null;

  if (createdOrder.pvzCode) {
    try {
      const cdek = await registerCdekOrder({
        orderId: createdOrder.id,
        recipientName: createdOrder.name,
        recipientPhone: createdOrder.phone,
        pvzCode: createdOrder.pvzCode,
        items,
      });

      cdekPackageInfo = cdek.package;

      const updateData: any = {
        tariffCode: CDEK_WAREHOUSE_WAREHOUSE_TARIFF,
      };

      if (cdek.uuid) {
        updateData.cdekUuid = cdek.uuid;
      }

      if (cdek.cdekNumber && cdek.cdekNumber !== createdOrder.trackNumber) {
        updateData.trackNumber = cdek.cdekNumber;
        effectiveTrackNumber = cdek.cdekNumber;
      }

      await prisma.order.update({
        where: { id: createdOrder.id },
        data: updateData,
      });

      console.log("✅ CDEK order registered:", {
        orderId: createdOrder.id,
        uuid: cdek.uuid,
        cdekNumber: cdek.cdekNumber,
        tariffCode: CDEK_WAREHOUSE_WAREHOUSE_TARIFF,
        package: cdek.package,
      });
    } catch (e: any) {
      console.log(
        "❌ CDEK REGISTER ERROR:",
        JSON.stringify(extractCdekError(e), null, 2)
      );
    }
  } else {
    console.log("ℹ️ CDEK skipped: no pvzCode for order", createdOrder.id);
  }

  const adminChatIds = parseChatIds(process.env.TG_ADMIN_CHAT_IDS);

  const pvzLine = draft.pvzCode
    ? `ПВЗ: ${
        draft.pvzCity ? draft.pvzCity + ", " : ""
      }<code>${draft.pvzCode}</code>\nАдрес ПВЗ: ${
        draft.pvzAddress ?? "—"
      }\n`
    : "";

  const deliveryLine =
    draft.deliveryPrice != null
      ? `Доставка: ${rubFromCents(Number(draft.deliveryPrice))}${
          draft.deliveryDays != null ? ` (${draft.deliveryDays} дн.)` : ""
        }\n`
      : "";

  const tariffLine =
    actualTariffCode != null
      ? `Тариф СДЭК: <code>${actualTariffCode}</code>\n`
      : "";

  const promoLine = draft.promoCode
    ? `Промокод: <code>${draft.promoCode}</code>\n`
    : "";

  const discountLine =
    Number(draft.discount ?? 0) > 0
      ? `Скидка: ${rubFromCents(Number(draft.discount))}\n`
      : "";

  const packageLine = cdekPackageInfo
    ? `Упаковка: ${cdekPackageInfo.type} (${cdekPackageInfo.lengthCm}×${cdekPackageInfo.widthCm}×${cdekPackageInfo.heightCm} см, ${cdekPackageInfo.weightGr} г)\n`
    : "";

  const adminTrackLine = effectiveTrackNumber
    ? `Трек номер: <code>${effectiveTrackNumber}</code>\n`
    : `Трек номер: будет присвоен автоматически после обработки в СДЭК\n`;

  const userTrackLine = effectiveTrackNumber
    ? `<b>Трек номер:</b> <code>${effectiveTrackNumber}</code>\n`
    : `<b>Трек номер:</b> будет присвоен автоматически после обработки в СДЭК\n`;

  const adminText =
    `<b>Новый заказ ✅ (оплачен)</b>\n` +
    `ID: <code>${createdOrder.id}</code>\n` +
    `Имя: ${draft.name}\n` +
    `Телефон: ${draft.phone}\n` +
    `${pvzLine}` +
    `${deliveryLine}` +
    `${tariffLine}` +
    `${promoLine}` +
    `${discountLine}` +
    `${packageLine}` +
    `Адрес: ${draft.address}\n` +
    `Пользователь: ${draft.email || "Не указан (клиент не авторизован)"}\n\n` +
    `<b>Состав заказа:</b>\n` +
    items
      .map((i) => {
        const title = String(i.title ?? "—");
        const q = Number(i.qty ?? i.quantity ?? 1);
        const price = Number(i.price ?? 0);
        return `• ${title} × ${q} = ${rubFromCents(price * q)}`;
      })
      .join("\n") +
    `\n\n<b>Итого:</b> ${rubFromCents(draft.total)}\n` +
    `Статус оплаты: <b>Оплачено ✅</b>\n` +
    `${adminTrackLine}` +
    `Ссылка на заказ в админке: <a href="https://satl.shop/admin/orders/${createdOrder.id}" target="_blank">Перейти к заказу</a>\n` +
    `\n\n<b>Внимание!</b> Проверьте остатки товара и своевременно отправьте заказ клиенту.`;

  for (const chatId of adminChatIds) {
    tgSendMessage(chatId, adminText).catch(() => {});
  }

  if (draft.userId) {
    const u = await prisma.user.findUnique({
      where: { id: draft.userId },
      select: { tgChatId: true },
    });

    if (u?.tgChatId) {
      const userText =
        `<b>Заказ успешно оплачен ✅</b>\n` +
        `Номер заказа: <code>${createdOrder.id}</code>\n` +
        `Сумма: ${rubFromCents(draft.total)}\n` +
        `${draft.promoCode ? `<b>Промокод:</b> <code>${draft.promoCode}</code>\n` : ""}` +
        `${Number(draft.discount ?? 0) > 0 ? `<b>Скидка:</b> ${rubFromCents(Number(draft.discount))}\n` : ""}` +
        `\n<b>Спасибо за покупку! 🎉</b>\n` +
        `Ваш заказ находится в обработке. Ожидайте уведомлений о доставке.\n\n` +
        `${userTrackLine}` +
        `Вы можете отслеживать статус: <a href="https://satl.shop/account/orders" target="_blank">Мои заказы</a>.`;

      tgSendMessage(u.tgChatId, userText).catch(() => {});
    }
  }

  console.log("✅ Order created from draft:", draft.id, "=>", createdOrder.id);
  return Response.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return await handleYaPayWebhook(req);
    }
    return await handleStatusWebhook(req);
  } catch (e: any) {
    console.log("❌ WEBHOOK ERROR:", e?.message || e);
    return Response.json({ ok: true });
  }
}