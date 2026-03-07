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

function pickBestTariff(raw: any) {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.tariff_codes)
    ? raw.tariff_codes
    : Array.isArray(raw?.tariffs)
    ? raw.tariffs
    : [];

  const normalized = list
    .map((t: any) => ({
      tariff_code: t.tariff_code ?? t.tariffCode ?? null,
      tariff_name: t.tariff_name ?? t.tariffName ?? null,
      delivery_sum: Number(t.delivery_sum ?? t.deliverySum ?? NaN),
      period_min: t.period_min ?? t.periodMin ?? null,
      period_max: t.period_max ?? t.periodMax ?? null,
    }))
    .filter((t: any) => t.tariff_code && Number.isFinite(t.delivery_sum));

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
      return Response.json({ error: "Bad JSON" }, { status: 400 });
    }

    const city = String(body?.city ?? "").trim();
    const pvzCode = String(body?.pvzCode ?? "").trim();
    const items: any[] = Array.isArray(body?.items) ? body.items : [];

    if (!city || !pvzCode) {
      return Response.json({ error: "city/pvzCode required" }, { status: 400 });
    }

    if (items.length === 0) {
      return Response.json({ error: "items required" }, { status: 400 });
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
      return Response.json(
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
      return Response.json(
        { error: "Some products not found", missingProductIds: missing },
        { status: 400 }
      );
    }

    const itemsCount = normalizedItems.reduce(
      (sum, it) => sum + Math.max(1, it.qty),
      0
    );

    const { totalWeightGr, pack } = buildPackageFromItemsCount(itemsCount);

    const [fromCode, toCode] = await Promise.all([
      cdekResolveCityCode(fromCity),
      cdekResolveCityCode(city),
    ]);

    const payload: any = {
      type: 1,
      lang: "rus",
      from_location: { code: fromCode },
      to_location: { code: toCode },
      packages: [
        {
          weight: pack.weight,
          length: pack.length,
          width: pack.width,
          height: pack.height,
        },
      ],
      delivery_point: pvzCode,
    };

    if (fromPvz) {
      payload.shipment_point = fromPvz;
    }

    const data = await cdekTariffList(payload);
    const { best, variants } = pickBestTariff(data);

    if (!best) {
      return Response.json(
        { error: "No tariffs", details: data, payload },
        { status: 400 }
      );
    }

    return Response.json({
      ok: true,
      fromCity,
      toCity: city,
      pvzCode,
      itemsCount,
      package: {
        type: pack.packageType,
        weightGr: totalWeightGr,
        lengthCm: pack.length,
        widthCm: pack.width,
        heightCm: pack.height,
      },
      best,
      variants,
    });
  } catch (e: any) {
    const msg = String(e?.message || e || "CDEK calc error");
    console.log("❌ /api/cdek/calc error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}