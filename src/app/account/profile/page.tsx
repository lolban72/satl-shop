import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AccountShell from "../ui/AccountShell";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/auth/login");

  // ✅ читаем данные ИЗ БД (а не из session), чтобы всегда было актуально
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, phone: true, email: true },
  });

  if (!user) redirect("/auth/login");

  return (
    <AccountShell active="profile">
      <ProfileClient
        initialName={user.name ?? ""}
        initialPhone={user.phone ?? ""}
        email={user.email}
      />
    </AccountShell>
  );
}
