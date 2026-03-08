import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ENV = String(process.env.CDEK_ENV || "TEST").toUpperCase(); // TEST | PROD

const CDEK_API_BASE =
  ENV === "PROD"
    ? "https://api.cdek.ru/v2"
    : "https://api.edu.cdek.ru/v2";

const CLIENT_ID = process.env.CDEK_CLIENT_ID || "";
const CLIENT_SECRET = process.env.CDEK_CLIENT_SECRET || "";

// in-memory cache токена
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

  const res = await fetch(`${CDEK_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    const msg =
      data?.error_description ||
      data?.message ||
      data?.error ||
      `OAuth error (${res.status})`;
    throw new Error(msg);
  }

  const token = String(data?.access_token || "").trim();
  const expiresInSec = Number(data?.expires_in || 3600);

  if (!token) {
    throw new Error("СДЭК не вернул access_token");
  }

  cachedToken = {
    token,
    expiresAt: Date.now() + expiresInSec * 1000,
  };

  return token;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // поддерживаем и q, и query
    const q = String(
      url.searchParams.get("q") || url.searchParams.get("query") || ""
    ).trim();

    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") || 10), 1),
      20
    );

    if (q.length < 2) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const token = await getCdekToken();

    const params = new URLSearchParams({
      country_codes: "RU",
      city: q,
      size: String(limit),
    });

    const res = await fetch(
      `${CDEK_API_BASE}/location/cities?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

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

    const seen = new Set<string>();

    const items = list
      .map((x: any) => {
        const code =
          x?.code != null && x?.code !== "" ? Number(x.code) : undefined;

        const city = String(x?.city || x?.city_name || "").trim();
        const region = String(x?.region || x?.region_name || "").trim();
        const country = String(x?.country || x?.country_code || "").trim();

        const full = [city, region, country].filter(Boolean).join(", ");

        return {
          code,
          city,
          region: region || undefined,
          country: country || undefined,
          full,
        };
      })
      .filter((x) => x.city)
      .filter((x) => {
        const key = `${x.code ?? ""}|${x.city}|${x.region ?? ""}|${x.country ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return NextResponse.json({ items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "cities error" },
      { status: 500 }
    );
  }
}