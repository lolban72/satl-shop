// ✅ src/app/api/cdek/cities/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Поддержка PROD/TEST как в доках/SDK
const CDEK_BASE = process.env.CDEK_BASE_URL || "https://api.cdek.ru/v2"; // можно поставить https://api.edu.cdek.ru/v2
const CLIENT_ID = process.env.CDEK_CLIENT_ID || "";
const CLIENT_SECRET = process.env.CDEK_CLIENT_SECRET || "";

// простой in-memory cache токена
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getCdekToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("CDEK_CLIENT_ID/CDEK_CLIENT_SECRET не заданы");
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const res = await fetch(`${CDEK_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    // СДЭК обычно возвращает error/error_description
    const msg =
      data?.error_description ||
      data?.message ||
      data?.error ||
      `OAuth error (${res.status})`;
    throw new Error(msg);
  }

  const token = String(data?.access_token || "");
  const expiresInSec = Number(data?.expires_in || 3600);

  if (!token) throw new Error("СДЭК не вернул access_token");

  cachedToken = {
    token,
    expiresAt: Date.now() + expiresInSec * 1000,
  };

  return token;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // ты дергаешь /api/cdek/cities?q=...&limit=10
    const q = String(url.searchParams.get("q") || "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 10), 1), 20);

    if (q.length < 2) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const token = await getCdekToken();

    // В СДЭК для location/cities используется параметр "city" (а не q)
    const params = new URLSearchParams({
      country_codes: "RU",
      city: q,
      size: String(limit),
    });

    const res = await fetch(`${CDEK_BASE}/location/cities?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      const msg =
        data?.message ||
        data?.error_description ||
        data?.error ||
        `Cities API error (${res.status})`;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const list = Array.isArray(data) ? data : [];

    // нормализуем под твой фронт: { city, region, country }
    const items = list
      .map((x: any) => ({
        city: String(x?.city || x?.city_name || "").trim(),
        region: String(x?.region || x?.region_name || "").trim() || undefined,
        country: String(x?.country_code || x?.country || "").trim() || undefined,
      }))
      .filter((x: any) => x.city);

    return NextResponse.json({ items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "cities error" }, { status: 500 });
  }
}