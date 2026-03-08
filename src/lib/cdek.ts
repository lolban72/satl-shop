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

  const r = await fetch(url, {
    method: "POST",
    cache: "no-store",
  });

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
      Accept: "application/json",
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
    `/v2/location/cities?city=${q}&size=20&country_codes=RU`,
    { method: "GET" }
  );

  const arr = Array.isArray(data) ? data : [];

  const exact =
    arr.find(
      (x: any) =>
        String(x?.city || "")
          .trim()
          .toLowerCase() === city.trim().toLowerCase()
    ) ?? arr[0];

  const code = exact?.code;

  if (!code) {
    throw new Error(`CDEK city not found: ${city}`);
  }

  return Number(code);
}

export async function cdekDeliveryPoints(cityCode: number) {
  const size = 1000;

  const data = await cdekFetchJson(
    `/v2/deliverypoints?city_code=${cityCode}&size=${size}`,
    { method: "GET" }
  );

  return Array.isArray(data) ? data : [];
}

export async function cdekTariffList(payload: any) {
  return await cdekFetchJson(`/v2/calculator/tarifflist`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}