import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import LabelClient from "./LabelClient";

export default async function LabelPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const order = await prisma.order.findUnique({
    where: { id },
  });

  if (!order) notFound();

  return <LabelClient order={order} />;
}