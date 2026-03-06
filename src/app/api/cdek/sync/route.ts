// src/app/api/cdek/sync/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCdekClient } from "@/lib/cdek-client";

export const runtime = "nodejs";

function mapCdekStatusToOrderStatus(rawStatus: string) {
  const s = String(rawStatus ?? "").toUpperCase();

  if (
    s.includes("DELIVERED") ||
    s.includes("ВРУЧЕН") ||
    s.includes("ВЫДАН")
  ) {
    return "DELIVERED";
  }

  if (
    s.includes("IN_TRANSIT") ||
    s.includes("TRANSIT") ||
    s.includes("ОТПРАВЛЕН") ||
    s.includes("В ПУТИ") ||
    s.includes("ГОТОВ К ВЫДАЧЕ") ||
    s.includes("ПРИНЯТ")
  ) {
    return "SHIPPED";
  }

  return null;
}

function getFirstEntity(raw: any) {
  if (Array.isArray(raw?.entities) && raw.entities.length > 0) {
    return raw.entities[0];
  }
  if (Array.isArray(raw?.entity) && raw.entity.length > 0) {
    return raw.entity[0];
  }
  if (raw?.entity && typeof raw.entity === "object") {
    return raw.entity;
  }
  return null;
}

function extractTrackNumber(raw: any): string | null {
  const entity = getFirstEntity(raw);

  return (
    String(entity?.cdek_number ?? entity?.number ?? "").trim() || null
  );
}

function extractStatus(raw: any): string | null {
  const entity = getFirstEntity(raw);

  return (
    String(
      entity?.statuses?.[0]?.code ??
        entity?.status?.code ??
        ""
    ).trim() || null
  );
}

function extractStatusName(raw: any): string | null {
  const entity = getFirstEntity(raw);

  return (
    String(
      entity?.statuses?.[0]?.name ??
        entity?.status?.name ??
        ""
    ).trim() || null
  );
}

async function fetchCdekOrderByUuid(uuid: string) {
  const client = getCdekClient();
  const anyClient = client as any;

  if (typeof anyClient.getOrders !== "function") {
    throw new Error("CDEK client does not support getOrders");
  }

  const res = await anyClient.getOrders({
    uuid,
  });

  return res;
}

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-webhook-secret") || "";
    const expected = process.env.ORDER_STATUS_WEBHOOK_SECRET || "";

    if (!expected || secret !== expected) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId ?? "").trim();

    const where = orderId
      ? { id: orderId, cdekUuid: { not: null } }
      : { cdekUuid: { not: null } };

    const orders = await prisma.order.findMany({
      where: where as any,
      select: {
        id: true,
        cdekUuid: true,
        trackNumber: true,
        status: true,
      },
      take: orderId ? 1 : 50,
      orderBy: { createdAt: "desc" },
    });

    const results: any[] = [];

    for (const order of orders) {
      try {
        if (!order.cdekUuid) continue;

        const raw = await fetchCdekOrderByUuid(order.cdekUuid);

        const cdekNumber = extractTrackNumber(raw);
        const statusCode = extractStatus(raw);
        const statusName = extractStatusName(raw);
        const mappedStatus = mapCdekStatusToOrderStatus(
          statusCode || statusName || ""
        );

        const updateData: any = {};

        if (cdekNumber && cdekNumber !== order.trackNumber) {
          updateData.trackNumber = cdekNumber;
        }

        if (
          mappedStatus &&
          mappedStatus !== String(order.status).toUpperCase()
        ) {
          updateData.status = mappedStatus;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.order.update({
            where: { id: order.id },
            data: updateData,
          });
        }

        results.push({
          orderId: order.id,
          ok: true,
          cdekUuid: order.cdekUuid,
          cdekNumber: cdekNumber || null,
          statusCode: statusCode || null,
          statusName: statusName || null,
          updated: Object.keys(updateData).length > 0,
          updateData,
          raw,
        });
      } catch (e: any) {
        results.push({
          orderId: order.id,
          ok: false,
          error: e?.message || "sync failed",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      count: results.length,
      results,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "cdek sync error" },
      { status: 500 }
    );
  }
}