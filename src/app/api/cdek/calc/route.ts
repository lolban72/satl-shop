import { prisma } from "@/lib/prisma";
import { cdekResolveCityCode, cdekTariffList } from "@/lib/cdek";

export const runtime = "nodejs";

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
    if (!body) return Response.json({ error: "Bad JSON" }, { status: 400 });

    const city = String(body?.city ?? "").trim();
    const pvzCode = String(body?.pvzCode ?? "").trim();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!city || !pvzCode) {
      return Response.json(
        { error: "city/pvzCode required" },
        { status: 400 }
      );
    }
    if (items.length === 0) {
      return Response.json({ error: "items required" }, { status: 400 });
    }

    // Откуда отправляем (фикс)
    const fromCity = String(process.env.CDEK_FROM_CITY ?? "Краснодар").trim();
    const fromPvz = String(process.env.CDEK_FROM_PVZ_CODE ?? "").trim();

    // Пакет по умолчанию (габариты) — пока один стандарт
    const defaultWeightGr = toInt(process.env.CDEK_DEFAULT_WEIGHT_GR, 500);
    const lengthCm = toInt(process.env.CDEK_DEFAULT_LENGTH_CM, 20);
    const widthCm = toInt(process.env.CDEK_DEFAULT_WIDTH_CM, 15);
    const heightCm = toInt(process.env.CDEK_DEFAULT_HEIGHT_CM, 10);

    // 1) Собираем productId + qty
    const normalizedItems = items
      .map((it: any) => ({
        productId: String(it?.productId ?? "").trim(),
        qty: toInt(it?.qty, 1),
      }))
      .filter((x: any) => x.productId && x.qty > 0);

    if (normalizedItems.length === 0) {
      return Response.json(
        { error: "items must contain productId/qty" },
        { status: 400 }
      );
    }

    // 2) Тянем товары из БД (габариты/вес)
    const productIds = Array.from(new Set(normalizedItems.map((x) => x.productId)));

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        weightGr: true,
        lengthCm: true,
        widthCm: true,
        heightCm: true,
      },
    });

    const byId = new Map(products.map((p) => [p.id, p]));

    // 3) Считаем общий вес (в граммах). Если вес не задан — берём defaultWeightGr/1шт.
    let totalWeightGr = 0;

    for (const it of normalizedItems) {
      const p = byId.get(it.productId);
      const w = toInt(p?.weightGr, defaultWeightGr);
      totalWeightGr += w * it.qty;
    }

    // CDEK требует вес пакета > 0
    totalWeightGr = Math.max(1, totalWeightGr);

    const [fromCode, toCode] = await Promise.all([
      cdekResolveCityCode(fromCity),
      cdekResolveCityCode(city),
    ]);

    // 4) Запрос тариффлиста (PVZ -> PVZ)
    const payload: any = {
      type: 1,
      lang: "rus",
      from_location: { code: fromCode },
      to_location: { code: toCode },
      packages: [
        {
          weight: totalWeightGr,
          length: lengthCm,
          width: widthCm,
          height: heightCm,
        },
      ],
      delivery_point: pvzCode,
    };

    // Отгрузка из одного ПВЗ (опционально)
    if (fromPvz) payload.shipment_point = fromPvz;

    const data = await cdekTariffList(payload);
    const { best, variants } = pickBestTariff(data);

    if (!best) {
      return Response.json(
        { error: "No tariffs", details: data },
        { status: 400 }
      );
    }

    return Response.json({
      ok: true,
      fromCity,
      toCity: city,
      pvzCode,
      package: {
        weightGr: totalWeightGr,
        lengthCm,
        widthCm,
        heightCm,
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