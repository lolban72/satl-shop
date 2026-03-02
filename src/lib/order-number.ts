export function orderNumber(id: string | null | undefined) {
  // после наших правок id уже короткий, просто страхуемся
  const s = String(id ?? "").trim();
  return s || "—";
}