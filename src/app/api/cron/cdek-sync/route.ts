// src/app/api/cron/cdek-sync/route.ts
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
  return String(entity?.cdek_number ?? entity?.number ?? "").trim() || null;
}

function extractStatus(raw: any): string | null {
  const entity = getFirstEntity(raw);
  return String(entity?.statuses?.[0]?.code ?? entity?.status?.code ?? "").trim() || null;
}

function extractStatusName(raw: any): string | null {
  const entity = getFirstEntity(raw);
  return String(entity?.statuses?.[0]?.name ?? entity?.status?.name ?? "").trim() || null;
}

async function fetchCdekOrderByUuid(uuid: string) {
  const client = getCdekClient();
  const anyClient = client as any;

  if (typeof anyClient.getOrders !== "function") {
    throw new Error("CDEK client does not support getOrders");
  }

  return await anyClient.getOrders({ uuid });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";
    const expected = process.env.CRON_SECRET || "";

    if (!expected || token !== expected) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const orders = await prisma.order.findMany({
      where: {
        cdekUuid: { not: null },
        OR: [
          { trackNumber: null },
          { status: "NEW" },
          { status: "SHIPPED" },
        ],
      },
      select: {
        id: true,
        cdekUuid: true,
        trackNumber: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const results: any[] = [];

    for (const order of orders) {
      try {
        if (!order.cdekUuid) continue;

        const raw = await fetchCdekOrderByUuid(order.cdekUuid);

        const cdekNumber = extractTrackNumber(raw);
        const statusCode = extractStatus(raw);
        const statusName = extractStatusName(raw);
        const mappedStatus = mapCdekStatusToOrderStatus(statusCode || statusName || "");

        const updateData: any = {};

        if (cdekNumber && cdekNumber !== order.trackNumber) {
          updateData.trackNumber = cdekNumber;
        }

        if (mappedStatus && mappedStatus !== String(order.status).toUpperCase()) {
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
      { ok: false, error: e?.message || "cron cdek sync error" },
      { status: 500 }
    );
  }
}