import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ENV = String(process.env.CDEK_ENV || "TEST").toUpperCase();

const CDEK_API_BASE =
  ENV === "PROD"
    ? "https://api.cdek.ru/v2"
    : "https://api.edu.cdek.ru/v2";

const CLIENT_ID = process.env.CDEK_CLIENT_ID || "";
const CLIENT_SECRET = process.env.CDEK_CLIENT_SECRET || "";

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

function normalizeText(v: any) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, " ");
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const q = normalizeText(
      url.searchParams.get("q") || url.searchParams.get("query") || ""
    );

    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") || 50), 1),
      100
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

    const data = await res.json().catch(() => ([] as any[]));

    if (!res.ok) {
      const msg =
        data?.message ||
        data?.error_description ||
        data?.error ||
        `Cities API error (${res.status})`;

      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const list = Array.isArray(data) ? data : [];

    // собираем нормальные города
    const prepared = list
      .map((x: any) => {
        const city = normalizeText(x?.city || x?.city_name);
        const region = normalizeText(x?.region || x?.region_name);
        const country = normalizeText(x?.country || x?.country_code);
        const code = Number(x?.code || 0);

        return {
          code,
          city,
          region: region || undefined,
          country: country || undefined,
          full: [city, region].filter(Boolean).join(", "),
        };
      })
      .filter((x) => x.city && Number.isFinite(x.code) && x.code > 0);

    // убираем дубли по названию города
    // оставляем первый нормальный вариант
    const byCity = new Map<string, (typeof prepared)[number]>();

    for (const item of prepared) {
      const key = item.city.toLowerCase();
      if (!byCity.has(key)) {
        byCity.set(key, item);
      }
    }

    const items = Array.from(byCity.values())
      .sort((a, b) => {
        const aq = a.city.toLowerCase();
        const bq = b.city.toLowerCase();
        const qq = q.toLowerCase();

        const aStarts = aq.startsWith(qq) ? 1 : 0;
        const bStarts = bq.startsWith(qq) ? 1 : 0;

        if (aStarts !== bStarts) return bStarts - aStarts;
        return aq.localeCompare(bq, "ru");
      })
      .slice(0, 12);

    return NextResponse.json({ items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "cities error" },
      { status: 500 }
    );
  }
}