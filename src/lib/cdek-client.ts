// src/lib/cdek-client.ts
import "server-only";
import { Cdek } from "cdek";

const ENV = String(process.env.CDEK_ENV ?? "TEST").toUpperCase(); // TEST | PROD
const url_base = ENV === "PROD" ? "https://api.cdek.ru/v2" : "https://api.edu.cdek.ru/v2";

export function getCdekClient() {
  const account = process.env.CDEK_CLIENT_ID;
  const password = process.env.CDEK_CLIENT_SECRET;

  if (!account || !password) {
    throw new Error("CDEK_CLIENT_ID/CDEK_CLIENT_SECRET не заданы");
  }

  return new Cdek({
    account,
    password,
    url_base,
  });
}