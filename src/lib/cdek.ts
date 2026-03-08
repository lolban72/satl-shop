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
  if (tokenCache && tokenCache.exp - 30_000 > now) {
    return tokenCache.token;
  }

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
  tokenCache = {
    token: String(data.access_token),
    exp: now + expMs,
  };

  return tokenCache.token;
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

// Город -> city_code
export async function cdekResolveCityCode(city: string): Promise<number> {
  const q = encodeURIComponent(String(city || "").trim());

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
          .toLowerCase() === String(city).trim().toLowerCase()
    ) ?? arr[0];

  const code = exact?.code;

  if (!code) {
    throw new Error(`CDEK city not found: ${city}`);
  }

  return Number(code);
}

// Все точки по коду города: ПВЗ + постаматы
export async function cdekDeliveryPoints(cityCode: number) {
  const all: any[] = [];
  const size = 1000;

  for (let page = 0; page < 10; page++) {
    const data = await cdekFetchJson(
      `/v2/deliverypoints?city_code=${cityCode}&type=ALL&size=${size}&page=${page}`,
      { method: "GET" }
    );

    const chunk = Array.isArray(data) ? data : [];

    if (chunk.length === 0) {
      break;
    }

    all.push(...chunk);

    if (chunk.length < size) {
      break;
    }
  }

  const seen = new Set<string>();

  return all.filter((item: any) => {
    const code = String(item?.code ?? "").trim();

    if (!code) return false;
    if (seen.has(code)) return false;

    seen.add(code);
    return true;
  });
}

/**
 * Калькулятор: список доступных тарифов (цена/сроки).
 * POST /v2/calculator/tarifflist
 */
export async function cdekTariffList(payload: any) {
  return await cdekFetchJson(`/v2/calculator/tarifflist`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}