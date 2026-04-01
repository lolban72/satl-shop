// src/lib/cdek-package.ts

export type CdekPackageType = "S" | "M" | "L";

export type CdekPackage = {
  packageType: CdekPackageType;
  weight: number; // граммы
  length: number; // см
  width: number; // см
  height: number; // см
};

function toSafeInt(v: unknown, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : def;
}

export function getDefaultUnitWeightGr() {
  return toSafeInt(process.env.CDEK_DEFAULT_WEIGHT_GR, 400);
}

export function getDefaultPackageSize() {
  return {
    length: toSafeInt(process.env.CDEK_DEFAULT_LENGTH_CM, 25),
    width: toSafeInt(process.env.CDEK_DEFAULT_WIDTH_CM, 30),
    height: toSafeInt(process.env.CDEK_DEFAULT_HEIGHT_CM, 5),
  };
}

export function getPackageForOrder(params: {
  itemsCount: number;
  totalWeightGr: number;
}): CdekPackage {
  const itemsCount = Math.max(1, Number(params.itemsCount || 0));
  const totalWeightGr = Math.max(1, Number(params.totalWeightGr || 0));
  const base = getDefaultPackageSize();

  // S — 1 легкая вещь
  if (itemsCount <= 1 && totalWeightGr <= 500) {
    return {
      packageType: "S",
      weight: Math.max(400, totalWeightGr),
      length: base.length,
      width: base.width,
      height: base.height,
    };
  }

  // M — 2-3 вещи / средний заказ
  if (itemsCount <= 3 && totalWeightGr <= 1500) {
    return {
      packageType: "M",
      weight: Math.max(700, totalWeightGr),
      length: Math.max(base.length, 30),
      width: Math.max(base.width, 30),
      height: Math.max(base.height, 10),
    };
  }

  // L — крупный заказ
  return {
    packageType: "L",
    weight: Math.max(1500, totalWeightGr),
    length: Math.max(base.length, 40),
    width: Math.max(base.width, 40),
    height: Math.max(base.height, 15),
  };
}

export function buildPackageFromItemsCount(itemsCount: number) {
  const unitWeight = getDefaultUnitWeightGr();
  const safeItemsCount = Math.max(1, Number(itemsCount || 0));
  const totalWeightGr = Math.max(1, safeItemsCount * unitWeight);

  return {
    itemsCount: safeItemsCount,
    totalWeightGr,
    pack: getPackageForOrder({
      itemsCount: safeItemsCount,
      totalWeightGr,
    }),
  };
}