// src/app/api/cdek/register/route.ts
import { NextResponse } from "next/server";
import { getCdekClient } from "@/lib/cdek-client";

export const runtime = "nodejs";

function onlyDigitsPhone(phone: string) {
  const s = String(phone ?? "").replace(/[^\d+]/g, "");
  return s.startsWith("+") ? s : `+${s}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const city = String(body?.city ?? "").trim();
    const pvzCode = String(body?.pvzCode ?? "").trim();
    const name = String(body?.name ?? "").trim();
    const phone = String(body?.phone ?? "").trim();

    if (!city) return NextResponse.json({ error: "city required" }, { status: 400 });
    if (!pvzCode) return NextResponse.json({ error: "pvzCode required" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
    if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

    const weight = Number(process.env.CDEK_DEFAULT_WEIGHT_GR ?? 400);
    const length = Number(process.env.CDEK_DEFAULT_LENGTH_CM ?? 20);
    const width = Number(process.env.CDEK_DEFAULT_WIDTH_CM ?? 15);
    const height = Number(process.env.CDEK_DEFAULT_HEIGHT_CM ?? 10);

    const fromCity = String(process.env.CDEK_FROM_CITY ?? "").trim();
    if (!fromCity) return NextResponse.json({ error: "CDEK_FROM_CITY env required" }, { status: 500 });

    const client = getCdekClient();

    // ⚠️ tariff_code: поставил 11 как дефолт (ПВЗ-ПВЗ), если в твоём /calc есть тариф — позже подставим его.
    const created = await client.addOrder({
      type: 1,
      number: `TEST-${Date.now()}`,
      tariff_code: 11,
      recipient: {
        name,
        phones: [{ number: onlyDigitsPhone(phone) }],
      },
      to_location: { city },
      delivery_point: pvzCode,
      from_location: { city: fromCity },
      packages: [
        {
          number: `PKG-${Date.now()}`,
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
    });

    const uuid = String((created as any)?.entity?.uuid ?? (created as any)?.uuid ?? "").trim();
    const cdekNumber = String((created as any)?.entity?.cdek_number ?? "").trim();

    if (!uuid) {
      return NextResponse.json({ error: "CDEK did not return uuid", raw: created }, { status: 500 });
    }

    return NextResponse.json({ ok: true, uuid, cdekNumber: cdekNumber || null, raw: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "cdek register error" }, { status: 500 });
  }
