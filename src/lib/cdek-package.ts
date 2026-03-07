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
  return toSafeInt(process.env.CDEK_DEFAULT_WEIGHT_GR, 500);
}

export function getPackageForOrder(params: {
  itemsCount: number;
  totalWeightGr: number;
}): CdekPackage {
  const itemsCount = Math.max(1, Number(params.itemsCount || 0));
  const totalWeightGr = Math.max(1, Number(params.totalWeightGr || 0));

  // S — 1 легкая вещь
  if (itemsCount <= 1 && totalWeightGr <= 500) {
    return {
      packageType: "S",
      weight: Math.max(300, totalWeightGr),
      length: 20,
      width: 15,
      height: 10,
    };
  }

  // M — 2-3 вещи / средний заказ
  if (itemsCount <= 3 && totalWeightGr <= 1500) {
    return {
      packageType: "M",
      weight: Math.max(700, totalWeightGr),
      length: 30,
      width: 20,
      height: 12,
    };
  }

  // L — крупный заказ
  return {
    packageType: "L",
    weight: Math.max(1500, totalWeightGr),
    length: 40,
    width: 30,
    height: 15,
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