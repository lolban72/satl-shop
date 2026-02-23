import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AccountShell from "../ui/AccountShell";
import ProfileClient from "./ProfileClient";

export const metadata = {
  title: "Личный кабинет | SATL",
};

export default async function ProfilePage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/auth/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      lastName: true, // ✅
      phone: true,
      email: true,
      tgChatId: true,
    },
  });

  if (!user) redirect("/auth/login");

  const tgLinked = Boolean(user.tgChatId);

  return (
    <AccountShell active="profile">
      <ProfileClient
        initialName={user.name ?? ""}
        initialLastName={user.lastName ?? ""} // ✅
        initialPhone={user.phone ?? ""}
        email={user.email}
        tgLinked={tgLinked}
      />
    </AccountShell>
  );
}