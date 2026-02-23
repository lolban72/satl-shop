import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AccountShell from "../ui/AccountShell";
import SubscriptionsClient from "./SubscriptionsClient";

export const metadata = {
  title: "Подписки | SATL",
};

export default async function SubscriptionsPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/auth/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { newsletterEnabled: true, tgChatId: true },
  });

  return (
    <AccountShell active="subscriptions">
      <SubscriptionsClient
        initialEnabled={Boolean(user?.newsletterEnabled)}
        tgLinked={Boolean(user?.tgChatId)}
      />
    </AccountShell>
  );
}