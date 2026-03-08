import { cdekResolveCityCode, cdekDeliveryPoints } from "@/lib/cdek";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const city = String(searchParams.get("city") || "").trim();
    const cityCodeRaw = String(searchParams.get("cityCode") || "").trim();

    let cityCode: number;

    if (cityCodeRaw) {
      cityCode = Number(cityCodeRaw);
      if (!Number.isFinite(cityCode) || cityCode <= 0) {
        return Response.json({ error: "invalid cityCode" }, { status: 400 });
      }
    } else {
      if (!city) {
        return Response.json(
          { error: "city or cityCode required" },
          { status: 400 }
        );
      }
      cityCode = await cdekResolveCityCode(city);
    }

    const points = await cdekDeliveryPoints(cityCode);

    const normalized = (Array.isArray(points) ? points : [])
      .map((p: any) => ({
        code: String(p?.code ?? "").trim(),
        name: String(p?.name ?? "ПВЗ").trim(),
        address: String(p?.location?.address_full ?? p?.address ?? "").trim(),
        lat: Number(p?.location?.latitude),
        lon: Number(p?.location?.longitude),
        workTime: String(p?.work_time ?? "").trim(),
        phones: Array.isArray(p?.phones)
          ? p.phones.map((x: any) => String(x?.number ?? "").trim()).filter(Boolean)
          : [],
      }))
      .filter((x: any) => x.code && x.address);

    return Response.json({
      city,
      cityCode,
      points: normalized,
    });
  } catch (e: any) {
    const msg = String(e?.message || e || "CDEK error");
    console.log("❌ /api/cdek/pvz error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}