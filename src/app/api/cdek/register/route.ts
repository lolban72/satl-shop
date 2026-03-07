import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCdekClient } from "@/lib/cdek-client";

export const runtime = "nodejs";

interface NormalizedItem {
  productId: string;
  qty: number;
}

function normalizePhone(phone: string) {
  const raw = String(phone ?? "").trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  return `+${digits}`;
}

function safeNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function toInt(v: any, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : def;
}

function extractCdekError(err: any) {
  const out: Record<string, any> = {
    message: err?.message || "CDEK request failed",
  };

  if (err?.response) out.response = err.response;
  if (err?.data) out.data = err.data;
  if (err?.body) out.body = err.body;
  if (err?.errors) out.errors = err.errors;
  if (err?.cause) out.cause = err.cause;

  if (err?.response?.data) out.responseData = err.response.data;
  if (err?.response?.body) out.responseBody = err.response.body;
  if (err?.response?.errors) out.responseErrors = err.response.errors;
  if (err?.response?.status) out.responseStatus = err.response.status;

  return out;
}

function getPackageForOrder(params: {
  itemsCount: number;
  totalWeightGr: number;
}) {
  const itemsCount = Math.max(1, Number(params.itemsCount || 0));
  const totalWeightGr = Math.max(1, Number(params.totalWeightGr || 0));

  if (itemsCount <= 1 && totalWeightGr <= 500) {
    return {
      weight: Math.max(300, totalWeightGr),
      length: 20,
      width: 15,
      height: 10,
      packageType: "S",
    };
  }

  if (itemsCount <= 3 && totalWeightGr <= 1500) {
    return {
      weight: Math.max(700, totalWeightGr),
      length: 30,
      width: 20,
      height: 12,
      packageType: "M",
    };
  }

  return {
    weight: Math.max(1500, totalWeightGr),
    length: 40,
    width: 30,
    height: 15,
    packageType: "L",
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const city = String(body?.city ?? "").trim();
    const pvzCode = String(body?.pvzCode ?? "").trim();
    const name = String(body?.name ?? "").trim();
    const phone = normalizePhone(body?.phone ?? "");
    const items: any[] = Array.isArray(body?.items) ? body.items : [];

    const tariffCode = safeNumber(
      body?.tariffCode ?? process.env.CDEK_DEFAULT_TARIFF_CODE ?? 11,
      11
    );

    if (!city) {
      return NextResponse.json({ error: "city required" }, { status: 400 });
    }

    if (!pvzCode) {
      return NextResponse.json({ error: "pvzCode required" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ error: "phone required" }, { status: 400 });
    }

    const fromCity = String(process.env.CDEK_FROM_CITY ?? "").trim();
    if (!fromCity) {
      return NextResponse.json(
        { error: "CDEK_FROM_CITY env required" },
        { status: 500 }
      );
    }

    const defaultUnitWeightGr = toInt(
      process.env.CDEK_DEFAULT_WEIGHT_GR,
      500
    );

    let itemsCount = 1;
    let totalWeightGr = defaultUnitWeightGr;
    let itemName = "SATL item";

    if (items.length > 0) {
      const normalizedItems: NormalizedItem[] = items
        .map((it: any): NormalizedItem => ({
          productId: String(it?.productId ?? "").trim(),
          qty: toInt(it?.qty, 1),
        }))
        .filter((x: NormalizedItem) => x.productId.length > 0 && x.qty > 0);

      if (normalizedItems.length > 0) {
        const productIds = Array.from(
          new Set(normalizedItems.map((x) => x.productId))
        );

        const products = await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, title: true },
        });

        const byId = new Map(products.map((p) => [p.id, p]));
        itemsCount = normalizedItems.reduce((sum, it) => sum + it.qty, 0);
        totalWeightGr = Math.max(1, itemsCount * defaultUnitWeightGr);

        const firstProduct = normalizedItems
          .map((it) => byId.get(it.productId))
          .find(Boolean);

        if (firstProduct?.title) {
          itemName =
            itemsCount > 1
              ? `${firstProduct.title} и др.`
              : String(firstProduct.title);
        }
      }
    }

    const pack = getPackageForOrder({
      itemsCount,
      totalWeightGr,
    });

    const ts = Date.now();
    const orderNumber = String(body?.number ?? `TEST-${ts}`).trim();

    const payload = {
      type: 1,
      number: orderNumber,
      tariff_code: tariffCode,
      recipient: {
        name,
        phones: [{ number: phone }],
      },
      from_location: {
        city: fromCity,
      },
      delivery_point: pvzCode,
      packages: [
        {
          number: `PKG-${ts}`,
          weight: pack.weight,
          length: pack.length,
          width: pack.width,
          height: pack.height,
          items: [
            {
              name: itemName,
              ware_key: `ORDER-${orderNumber}`,
              payment: { value: 0 },
              cost: 1000,
              amount: 1,
              weight: pack.weight,
            },
          ],
        },
      ],
    };

    console.log("[CDEK_REGISTER] request body:", JSON.stringify(body, null, 2));
    console.log("[CDEK_REGISTER] payload:", JSON.stringify(payload, null, 2));

    const client = getCdekClient();

    let created: any;
    try {
      created = await client.addOrder(payload);
    } catch (err: any) {
      const details = extractCdekError(err);

      console.error("[CDEK_REGISTER] addOrder failed:");
      console.error(JSON.stringify(details, null, 2));

      return NextResponse.json(
        {
          error: "CDEK rejected order",
          details,
          payload,
        },
        { status: 400 }
      );
    }

    console.log("[CDEK_REGISTER] success:", JSON.stringify(created, null, 2));

    const entity = (created as any)?.entity ?? null;
    const uuid = String(entity?.uuid ?? "").trim();
    const cdekNumber = String(entity?.cdek_number ?? "").trim();

    if (!uuid) {
      return NextResponse.json(
        {
          error: "CDEK did not return uuid",
          raw: created,
          payload,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      uuid,
      cdekNumber: cdekNumber || null,
      package: {
        type: pack.packageType,
        weightGr: pack.weight,
        lengthCm: pack.length,
        widthCm: pack.width,
        heightCm: pack.height,
      },
      raw: created,
    });
  } catch (e: any) {
    console.error("[CDEK_REGISTER] fatal error:", e);

    return NextResponse.json(
      {
        error: e?.message || "cdek register error",
      },
      { status: 500 }
    );
  }
}