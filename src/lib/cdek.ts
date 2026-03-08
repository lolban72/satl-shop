import "server-only";

type CdekEnv = "TEST" | "PROD";

const ENV = (process.env.CDEK_ENV || "TEST").toUpperCase() as CdekEnv;

const BASE =
  ENV === "PROD" ? "https://api.cdek.ru" : "https://api.edu.cdek.ru";

const CLIENT_ID = process.env.CDEK_CLIENT_ID || "";
const CLIENT_SECRET = process.env.CDEK_CLIENT_SECRET || "";

let tokenCache: { token: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("CDEK_CLIENT_ID/CDEK_CLIENT_SECRET missing in env");
  }

  const now = Date.now();
  if (tokenCache && tokenCache.exp - 30_000 > now) return tokenCache.token;

  const url =
    `${BASE}/v2/oauth/token` +
    `?grant_type=client_credentials` +
    `&client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&client_secret=${encodeURIComponent(CLIENT_SECRET)}`;

  const r = await fetch(url, { method: "POST", cache: "no-store" });
  const data = await r.json().catch(() => ({}));

  if (!r.ok || !data?.access_token) {
    throw new Error(`CDEK oauth failed: ${r.status} ${JSON.stringify(data)}`);
  }

  const expMs = Number(data.expires_in ?? 900) * 1000;
  tokenCache = { token: data.access_token, exp: now + expMs };
  return data.access_token;
}

async function cdekFetchJson(path: string, init?: RequestInit) {
  const token = await getToken();

  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`CDEK ${path} failed: ${r.status} ${JSON.stringify(data)}`);
  }
  return data;
}

export async function cdekResolveCityCode(city: string): Promise<number> {
  const q = encodeURIComponent(city);
  const data = await cdekFetchJson(
    `/v2/location/cities?city=${q}&size=1&country_codes=RU`,
    { method: "GET" }
  );

  const first = Array.isArray(data) ? data[0] : data?.[0];
  const code = first?.code;

  if (!code) throw new Error(`CDEK city not found: ${city}`);
  return Number(code);
}

export async function cdekSuggestCities(query: string) {
  const q = String(query || "").trim();
  if (!q) return [];

  const data = await cdekFetchJson(
    `/v2/location/cities?city=${encodeURIComponent(q)}&size=20&country_codes=RU`,
    { method: "GET" }
  );

  const arr = Array.isArray(data) ? data : [];

  return arr.map((x: any) => ({
    code: Number(x?.code),
    city: String(x?.city ?? "").trim(),
    region: String(x?.region ?? "").trim(),
    country: String(x?.country ?? "").trim(),
    full: [
      String(x?.city ?? "").trim(),
      String(x?.region ?? "").trim(),
      String(x?.country ?? "").trim(),
    ]
      .filter(Boolean)
      .join(", "),
  }));
}

export async function cdekDeliveryPoints(cityCode: number) {
  const all: any[] = [];
  const size = 500;

  for (let page = 0; page < 20; page++) {
    const data = await cdekFetchJson(
      `/v2/deliverypoints?city_code=${cityCode}&type=PVZ&page=${page}&size=${size}`,
      { method: "GET" }
    );

    const chunk = Array.isArray(data) ? data : [];

    if (!chunk.length) break;

    all.push(...chunk);

    if (chunk.length < size) break;
  }

  return all;
}

export async function cdekTariffList(payload: any) {
  return await cdekFetchJson(`/v2/calculator/tarifflist`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}