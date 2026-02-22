import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AccountShell from "../ui/AccountShell";
import AddressClient from "./AddressClient";

export default async function AddressPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/auth/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      addressCountry: true,
      addressRegion: true,
      addressCity: true,
      addressStreet: true,
      addressHouse: true,
      addressApartment: true,
      addressPostcode: true,
      addressComment: true,
    },
  });

  return (
    <AccountShell active="address">
      <AddressClient
        initial={{
          addressCountry: user?.addressCountry ?? "",
          addressRegion: user?.addressRegion ?? "",
          addressCity: user?.addressCity ?? "",
          addressStreet: user?.addressStreet ?? "",
          addressHouse: user?.addressHouse ?? "",
          addressApartment: user?.addressApartment ?? "",
          addressPostcode: user?.addressPostcode ?? "",
          addressComment: user?.addressComment ?? "",
        }}
      />
    </AccountShell>
  );
}
