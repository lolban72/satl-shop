import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const pick = (v: any) => (typeof v === "string" ? v.trim() : "");

  const deliveryType = pick(body.deliveryType) || "pickup";
  const addressCity = pick(body.addressCity);
  const pvzCode = pick(body.pvzCode);
  const pvzAddress = pick(body.pvzAddress);
  const pvzName = pick(body.pvzName);
  const addressComment = pick(body.addressComment);

  if (!addressCity) {
    return NextResponse.json({ error: "Укажите город" }, { status: 400 });
  }

  if (!pvzCode || !pvzAddress) {
    return NextResponse.json(
      { error: "Выберите пункт выдачи" },
      { status: 400 }
    );
  }

  const combined = [addressCity, pvzName, pvzAddress, pvzCode ? `ПВЗ ${pvzCode}` : ""]
    .filter(Boolean)
    .join(", ");

  await prisma.user.update({
    where: { id: userId },
    data: {
      addressCity: addressCity || null,
      addressComment: addressComment || null,

      pvzCode: pvzCode || null,
      pvzAddress: pvzAddress || null,
      pvzName: pvzName || null,

      // очищаем старые поля обычного адреса
      addressCountry: null,
      addressRegion: null,
      addressStreet: null,
      addressHouse: null,
      addressApartment: null,
      addressPostcode: null,

      // для совместимости
      address: combined || null,
    },
  });

  return NextResponse.json({
    ok: true,
    saved: {
      deliveryType,
      addressCity,
      pvzCode,
      pvzAddress,
      pvzName,
      addressComment,
    },
  });
}