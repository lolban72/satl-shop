import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCdekClient } from "@/lib/cdek-client";
import { buildPackageFromItemsCount } from "@/lib/cdek-package";
import { cdekResolveCityCode } from "@/lib/cdek";

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

  if (digits.length === 11 && digits.startsWith("8")) {
    return `+7${digits.slice(1)}`;
  }

  if (digits.length === 11 && digits.startsWith("7")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+7${digits}`;
  }

  return `+${digits}`;
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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const city = String(body?.city ?? "").trim();
    const pvzCode = String(body?.pvzCode ?? "").trim();
    const name = String(body?.name ?? "").trim();
    const phone = normalizePhone(body?.phone ?? "");
    const items: any[] = Array.isArray(body?.items) ? body.items : [];
    const tariffCode = Number(body?.tariffCode);

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

    if (!Number.isFinite(tariffCode) || tariffCode <= 0) {
      return NextResponse.json(
        { error: "tariffCode required" },
        { status: 400 }
      );
    }

    const fromCity = String(process.env.CDEK_FROM_CITY ?? "").trim();
    const fromPvz = String(process.env.CDEK_FROM_PVZ_CODE ?? "").trim();

    if (!fromCity) {
      return NextResponse.json(
        { error: "CDEK_FROM_CITY env required" },
        { status: 500 }
      );
    }

    let itemsCount = 1;
    let itemName = "SATL item";
    let declaredCost = 1000;

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
          select: { id: true, title: true, price: true },
        });

        const byId = new Map(products.map((p) => [p.id, p]));

        itemsCount = normalizedItems.reduce((sum, it) => sum + it.qty, 0);

        const firstProduct = normalizedItems
          .map((it) => byId.get(it.productId))
          .find(Boolean);

        if (firstProduct?.title) {
          itemName =
            itemsCount > 1
              ? `${firstProduct.title} и др.`
              : String(firstProduct.title);
        }

        declaredCost = normalizedItems.reduce((sum, it) => {
          const p = byId.get(it.productId);
          const price = Number(p?.price ?? 0);
          return sum + price * it.qty;
        }, 0);

        if (!Number.isFinite(declaredCost) || declaredCost <= 0) {
          declaredCost = 1000;
        }
      }
    }

    const { pack } = buildPackageFromItemsCount(itemsCount);

    const ts = Date.now();
    const orderNumber = String(body?.number ?? `ORDER-${ts}`).trim();

    const [fromCode, toCode] = await Promise.all([
      cdekResolveCityCode(fromCity),
      cdekResolveCityCode(city),
    ]);

    const payload: any = {
      type: 1,
      number: orderNumber,
      tariff_code: tariffCode,
      recipient: {
        name,
        phones: [{ number: phone }],
      },
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
              cost: declaredCost,
              amount: itemsCount,
              weight: Math.max(
                1,
                Math.round(pack.weight / Math.max(itemsCount, 1))
              ),
            },
          ],
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

    const invalidRequest = Array.isArray(created?.requests)
      ? created.requests.find(
          (r: any) =>
            r?.state === "INVALID" ||
            (Array.isArray(r?.errors) && r.errors.length > 0)
        )
      : null;

    if (invalidRequest) {
      return NextResponse.json(
        {
          error: "CDEK request is invalid",
          requests: created.requests,
          payload,
          raw: created,
        },
        { status: 400 }
      );
    }

    const entity = created?.entity ?? null;
    const uuid = String(entity?.uuid ?? "").trim();

    const cdekNumber =
      String(
        created?.related_entities?.find?.((x: any) => x?.cdek_number)
          ?.cdek_number ??
          created?.entity?.cdek_number ??
          ""
      ).trim() || null;

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
      cdekNumber,
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