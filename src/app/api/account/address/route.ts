import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const pick = (v: any) => (typeof v === "string" ? v.trim() : "");

  const addressCountry = pick(body.addressCountry);
  const addressRegion = pick(body.addressRegion);
  const addressCity = pick(body.addressCity);
  const addressStreet = pick(body.addressStreet);
  const addressHouse = pick(body.addressHouse);
  const addressApartment = pick(body.addressApartment);
  const addressPostcode = pick(body.addressPostcode);
  const addressComment = pick(body.addressComment);

  // ✅ (опционально) соберём красивую строку в старое поле address
  const combined = [
    addressPostcode,
    addressCountry,
    addressRegion,
    addressCity,
    [addressStreet, addressHouse].filter(Boolean).join(" "),
    addressApartment ? `кв. ${addressApartment}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  await prisma.user.update({
    where: { id: userId },
    data: {
      addressCountry: addressCountry || null,
      addressRegion: addressRegion || null,
      addressCity: addressCity || null,
      addressStreet: addressStreet || null,
      addressHouse: addressHouse || null,
      addressApartment: addressApartment || null,
      addressPostcode: addressPostcode || null,
      addressComment: addressComment || null,

      // ✅ сохраняем совместимость со старым полем
      address: combined || null,
    },
  });

  return NextResponse.json({ ok: true });
}
