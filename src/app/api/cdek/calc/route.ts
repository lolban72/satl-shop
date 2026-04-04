import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cdekResolveCityCode, cdekTariffList } from "@/lib/cdek";
import { buildPackageFromItemsCount } from "@/lib/cdek-package";

export const runtime = "nodejs";

interface NormalizedItem {
  productId: string;
  qty: number;
}

function toInt(v: any, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : def;
}

function getAllowedTariffs() {
  return String(process.env.CDEK_ALLOWED_TARIFFS ?? "")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x) && x > 0);
}

function pickBestTariff(raw: any) {
  const allowed = new Set(getAllowedTariffs());

  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.tariff_codes)
    ? raw.tariff_codes
    : Array.isArray(raw?.tariffs)
    ? raw.tariffs
    : [];

  const normalized = list
    .map((t: any) => ({
      tariff_code: Number(t.tariff_code ?? t.tariffCode ?? NaN),
      tariff_name: t.tariff_name ?? t.tariffName ?? null,
      delivery_sum: Number(t.delivery_sum ?? t.deliverySum ?? NaN),
      period_min: t.period_min ?? t.periodMin ?? null,
      period_max: t.period_max ?? t.periodMax ?? null,
      delivery_mode: Number(t.delivery_mode ?? t.deliveryMode ?? NaN),
    }))
    .filter(
      (t: any) =>
        Number.isFinite(t.tariff_code) && Number.isFinite(t.delivery_sum)
    )
    .filter((t: any) => allowed.size === 0 || allowed.has(t.tariff_code));

  normalized.sort((a: any, b: any) => a.delivery_sum - b.delivery_sum);

  return {
    best: normalized[0] ?? null,
    variants: normalized.slice(0, 5),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
    }

    const city = String(body?.city ?? "").trim();
    const pvzCode = String(body?.pvzCode ?? "").trim();
    const items: any[] = Array.isArray(body?.items) ? body.items : [];

    if (!city) {
      return NextResponse.json({ error: "city required" }, { status: 400 });
    }

    if (!pvzCode) {
      return NextResponse.json({ error: "pvzCode required" }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: "items required" }, { status: 400 });
    }

    const fromCity = String(process.env.CDEK_FROM_CITY ?? "Краснодар").trim();
    const fromPvz = String(process.env.CDEK_FROM_PVZ_CODE ?? "").trim();

    const normalizedItems: NormalizedItem[] = items
      .map(
        (it: any): NormalizedItem => ({
          productId: String(it?.productId ?? "").trim(),
          qty: toInt(it?.qty, 1),
        })
      )
      .filter((x: NormalizedItem) => x.productId.length > 0 && x.qty > 0);

    if (normalizedItems.length === 0) {
      return NextResponse.json(
        { error: "items must contain productId/qty" },
        { status: 400 }
      );
    }

    const productIds = Array.from(
      new Set(normalizedItems.map((x: NormalizedItem) => x.productId))
    );

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });

    const existingIds = new Set(products.map((p) => p.id));
    const missing = productIds.filter((id) => !existingIds.has(id));

    if (missing.length > 0) {
      return NextResponse.json(
        { error: "Some products not found", missingProductIds: missing },
        { status: 400 }
      );
    }

    const itemsCount = normalizedItems.reduce(
      (sum, it) => sum + Math.max(1, it.qty),
      0
    );

    const { pack } = buildPackageFromItemsCount(itemsCount);

    const [fromCode, toCode] = await Promise.all([
      cdekResolveCityCode(fromCity),
      cdekResolveCityCode(city),
    ]);

    const payload: any = {
      type: 1,
      lang: "rus",
      packages: [
        {
          weight: pack.weight,
          length: pack.length,
          width: pack.width,
          height: pack.height,
        },
      ],
    };

    // Откуда
    if (fromPvz) {
      payload.shipment_point = fromPvz;
    } else {
      payload.from_location = { code: fromCode };
    }

    // Куда
    if (pvzCode) {
      payload.delivery_point = pvzCode;
    } else {
      payload.to_location = { code: toCode };
    }

    console.log("[CDEK_CALC] request body:", JSON.stringify(body, null, 2));
    console.log("[CDEK_CALC] payload:", JSON.stringify(payload, null, 2));

    const data = await cdekTariffList(payload);
    const { best, variants } = pickBestTariff(data);

    if (!best) {
      return NextResponse.json(
        {
          error: "No tariffs",
          details: data,
          payload,
          allowedTariffs: getAllowedTariffs(),
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      fromCity,
      toCity: city,
      pvzCode,
      itemsCount,
      package: {
        type: pack.packageType,
        weightGr: pack.weight,
        lengthCm: pack.length,
        widthCm: pack.width,
        heightCm: pack.height,
      },
      best,
      variants,
    });
  } catch (e: any) {
    const msg = String(e?.message || e || "CDEK calc error");
    console.error("[CDEK_CALC] error:", e);

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}