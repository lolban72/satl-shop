import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import CheckoutForm from "./ui/CheckoutForm";

export const metadata = {
  title: "Оформление заказа | SATL",
};

export default async function CheckoutPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;

  const defaults = userId
    ? await prisma.user
        .findUnique({
          where: { id: userId },
          select: {
            name: true,
            phone: true,
            email: true,
            address: true,
            addressCity: true,
            tgChatId: true,
            pvzCode: true,
            pvzAddress: true,
            pvzName: true,
          },
        })
        .then((user) => ({
          name: user?.name ?? user?.email ?? "",
          phone: user?.phone ?? "",
          address: user?.pvzAddress ?? user?.address ?? "",
          city: user?.addressCity ?? "",
          tgChatId: user?.tgChatId ?? null,
          pvzCode: user?.pvzCode ?? "",
          pvzAddress: user?.pvzAddress ?? "",
          pvzName: user?.pvzName ?? "",
        }))
    : {
        name: "",
        phone: "",
        address: "",
        city: "",
        tgChatId: null,
        pvzCode: "",
        pvzAddress: "",
        pvzName: "",
      };

  return <CheckoutForm initial={defaults} />;
}