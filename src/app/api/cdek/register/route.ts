// src/app/api/cdek/register/route.ts
import { NextResponse } from "next/server";
import { getCdekClient } from "@/lib/cdek-client";

export const runtime = "nodejs";

function normalizePhone(phone: string) {
  const raw = String(phone ?? "").trim();

  if (!raw) return "";

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");

  if (!digits) return "";
  return hasPlus ? `+${digits}` : `+${digits}`;
}

function safeNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
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

  // иногда библиотеки кладут полезное внутрь
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

    const weight = safeNumber(process.env.CDEK_DEFAULT_WEIGHT_GR, 400);
    const length = safeNumber(process.env.CDEK_DEFAULT_LENGTH_CM, 20);
    const width = safeNumber(process.env.CDEK_DEFAULT_WIDTH_CM, 15);
    const height = safeNumber(process.env.CDEK_DEFAULT_HEIGHT_CM, 10);

    const fromCity = String(process.env.CDEK_FROM_CITY ?? "").trim();
    if (!fromCity) {
      return NextResponse.json(
        { error: "CDEK_FROM_CITY env required" },
        { status: 500 }
      );
    }

    const ts = Date.now();

    const payload = {
      type: 1,
      number: `TEST-${ts}`,
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
          weight,
          length,
          width,
          height,
          items: [
            {
              name: "SATL item",
              ware_key: "SKU-TEST",
              payment: { value: 0 },
              cost: 1000,
              amount: 1,
              weight,
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

    const uuid = String(
      created?.entity?.uuid ?? created?.uuid ?? ""
    ).trim();

    const cdekNumber = String(
      created?.entity?.cdek_number ?? created?.cdek_number ?? ""
    ).trim();

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