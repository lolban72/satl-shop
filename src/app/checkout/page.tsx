import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import CheckoutForm from "./ui/CheckoutForm";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Оформление заказа | SATL",
};

export default async function CheckoutPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;

  // если оформление только для авторизованных
  // if (!userId) redirect("/auth/login?next=/checkout");

  const defaults = userId
    ? await prisma.user
        .findUnique({
          where: { id: userId },
          select: {
            name: true,
            phone: true,
            address: true,
            email: true,
            tgChatId: true, // ✅ ДОБАВИЛИ
          },
        })
        .then((user) => ({
          name: user?.name ?? user?.email ?? "",
          phone: user?.phone ?? "",
          address: user?.address ?? "",
          tgChatId: user?.tgChatId ?? null, // ✅ ДОБАВИЛИ
        }))
    : {
        name: "",
        phone: "",
        address: "",
        tgChatId: null, // ✅ ДОБАВИЛИ
      };

  return <CheckoutForm initial={defaults} />;
}