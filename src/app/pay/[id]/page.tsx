import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import YaPayButton from "./YaPayButton";

export default async function PayPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const draft = await prisma.paymentDraft.findUnique({ where: { id } });
  if (!draft) notFound();

  // если уже оплачено — можно сразу на успех/заказы
  if (draft.status === "PAID") redirect("/pay/success/" + draft.id);

  return (
    <div className="mx-auto max-w-[520px] px-4 py-10">
      <div className="text-[22px] font-semibold">Оплата</div>
      <div className="mt-2 text-[12px] text-black/60 font-mono">{draft.id}</div>

      <div className="mt-6 rounded-2xl border p-4">
        <YaPayButton draftId={draft.id} />
      </div>

      <div className="mt-4 text-[12px] text-black/50">
        После оплаты мы автоматически создадим заказ и покажем страницу успеха.
      </div>
    </div>
  );
}