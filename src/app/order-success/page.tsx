import Link from "next/link";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;

  return (
    <div
      className="
        mx-auto max-w-[1440px] text-black bg-white
        px-[16px] pt-[28px] pb-[70px]
        sm:px-[24px] sm:pt-[36px] sm:pb-[90px]
        md:px-[65px] md:pt-[90px] md:pb-[160px]
      "
    >
      <div className="max-w-[720px]">
        {/* TITLE */}
        <div className="text-[22px] sm:text-[24px] md:text-[28px] font-semibold tracking-[-0.02em]">
          Заказ принят
        </div>

        <div className="mt-[8px] text-[12px] sm:text-[13px] text-black/55">
          Спасибо за покупку. Мы свяжемся с вами для подтверждения доставки.
        </div>

        {/* ORDER NUMBER */}
        <div className="mt-[22px] sm:mt-[26px] md:mt-[32px] border border-black/10 p-[16px] sm:p-[18px] md:p-[22px]">
          <div className="text-[10px] uppercase tracking-[0.12em] text-black/55">
            Номер заказа
          </div>

          <div className="mt-[8px] font-mono text-[14px] sm:text-[15px] md:text-[16px] tracking-[0.02em] break-all">
            {orderId ?? "—"}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="mt-[22px] sm:mt-[26px] md:mt-[36px] flex flex-col sm:flex-row flex-wrap gap-[10px] sm:gap-[14px]">
          <Link
            href="/catalog"
            className="
              flex h-[46px] w-full sm:w-[220px] items-center justify-center
              bg-black text-white text-[10px] font-bold uppercase tracking-[0.12em]
              hover:bg-black/85 transition
            "
          >
            В каталог
          </Link>

          <Link
            href="/"
            className="
              flex h-[46px] w-full sm:w-[220px] items-center justify-center
              border border-black/20 text-[10px] font-semibold uppercase tracking-[0.12em]
              text-black/70 hover:border-black/45 hover:text-black transition
            "
          >
            На главную
          </Link>
        </div>

        {/* INFO TEXT */}
        <div className="mt-[18px] sm:mt-[22px] md:mt-[28px] text-[10px] sm:text-[11px] italic leading-[1.35] text-black/45">
          Если у вас возникнут вопросы по заказу, пожалуйста, сохраните номер заказа и свяжитесь с поддержкой.
        </div>
      </div>
    </div>
  );
}
