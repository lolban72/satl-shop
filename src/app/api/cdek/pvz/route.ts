import { cdekResolveCityCode, cdekDeliveryPoints } from "@/lib/cdek";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const city = String(searchParams.get("city") || "").trim();

    if (!city) return Response.json({ error: "city required" }, { status: 400 });

    const cityCode = await cdekResolveCityCode(city);
    const points = await cdekDeliveryPoints(cityCode);

    // нормализуем под фронт
    const normalized = (Array.isArray(points) ? points : []).map((p: any) => ({
      code: String(p.code),
      name: String(p.name ?? "ПВЗ"),
      address: String(p.location?.address_full ?? p.address ?? ""),
      lat: Number(p.location?.latitude),
      lon: Number(p.location?.longitude),
      workTime: String(p.work_time ?? ""),
      phones: (p.phones ?? []).map((x: any) => String(x.number)).filter(Boolean),
    }));

    return Response.json({ city, cityCode, points: normalized });
  } catch (e: any) {
    console.log("CDEK PVZ error:", e?.message || e);
    return Response.json({ error: e?.message || "CDEK error" }, { status: 500 });
  }
}