import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AccountShell from "../ui/AccountShell";
import AddressClient from "./AddressClient";

export const metadata = {
  title: "Пункт выдачи | SATL",
};

export default async function AddressPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/auth/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      addressCity: true,
      addressComment: true,
      pvzCode: true,
      pvzAddress: true,
      pvzName: true,
    },
  });

  return (
    <AccountShell active="address">
      <AddressClient
        initial={{
          addressCity: user?.addressCity ?? "",
          pvzCode: user?.pvzCode ?? "",
          pvzAddress: user?.pvzAddress ?? "",
          pvzName: user?.pvzName ?? "",
          addressComment: user?.addressComment ?? "",
        }}
      />
    </AccountShell>
  );
}