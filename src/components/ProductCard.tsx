import Link from "next/link";

export default function ProductCard({
  slug,
  title,
  price,
  imageUrl,
  isSoon = false,
  discountPercent = 0,
}: {
  slug: string;
  title: string;
  price: number;
  imageUrl?: string | null;
  isSoon?: boolean;
  discountPercent?: number;
}) {
  const Wrapper: any = isSoon ? "div" : Link;
  const wrapperProps = isSoon ? {} : { href: `/product/${slug}` };

  const showDiscount = !isSoon && (discountPercent ?? 0) > 0;

  return (
    <Wrapper
      {...wrapperProps}
      className="
        relative block text-center overflow-visible
        w-full md:w-[400px]
      "
    >
      {/* ✅ СКИДКА */}
      {showDiscount ? (
        <div className="absolute right-[8px] md:right-[18px] top-[5px] md:top-[-28px] z-30 pointer-events-none">
          <span
            className="text-[15px] md:text-[20px] leading-none"
            style={{ fontFamily: "Yeast", fontWeight: 300, color: "#B60404" }}
          >
            -{discountPercent}
          </span>
          <span
            className="text-[12px] md:text-[16px] leading-none"
            style={{
              fontFamily: "YrsaBold",
              fontWeight: 700,
              color: "#B60404",
              marginLeft: "1px",
            }}
          >
            %
          </span>
        </div>
      ) : null}

      {/* ОБЛАСТЬ ИЗОБРАЖЕНИЯ */}
      <div
        className="
          relative mx-auto
          w-[100%] sm:w-full md:w-[400px]
          aspect-[0.9/1] sm:aspect-[4/3]
          md:h-[300px]
        "
      >
        {/* ✅ свечение/тень */}
        {!isSoon && (
          <div
            className="
              absolute inset-0
              rounded-[28px] sm:rounded-[40px] md:rounded-[60px]
              opacity-60 md:opacity-70
              blur-[20px] sm:blur-[22px] md:blur-[38px]
            "
            style={{ backgroundColor: "#929292" }}
            aria-hidden="true"
          />
        )}

        {/* ===== MOBILE IMAGE (НЕ РЕЖЕМ) ===== */}
        <div className="md:hidden absolute inset-0 z-10">
          {/* скруглённая “рамка” */}
          <div className="absolute inset-0 rounded-[28px] sm:rounded-[40px]" />
          {/* фото без клипа */}
          <div className="absolute inset-0 z-20 p-[18px] overflow-visible">
            <img
              src={imageUrl ?? "https://picsum.photos/seed/product/800/600"}
              alt={title}
              className="h-full w-full object-contain scale-[1.35]"
              draggable={false}
            />
          </div>
        </div>

        {/* ===== DESKTOP IMAGE (АККУРАТНО ВНУТРИ) ===== */}
        <div className="hidden md:block absolute inset-0 z-10 overflow-hidden rounded-[60px]">
          <img
            src={imageUrl ?? "https://picsum.photos/seed/product/800/600"}
            alt={title}
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>

        {/* ===== СКОРО OVERLAY (поверх обоих вариантов) ===== */}
        {isSoon && (
          <div className="absolute inset-0 z-20">
            <div
              className="
                absolute inset-0
                rounded-[24px] sm:rounded-[34px] md:rounded-[50px]
                bg-black/15 backdrop-blur-[22px] md:backdrop-blur-[28px]
              "
            />
            <div className="absolute inset-0 grid place-items-center">
              <div
                className="text-[34px] sm:text-[40px] md:text-[64px] tracking-[-0.02em] text-white uppercase"
                style={{
                  fontFamily: "Montserrat",
                  fontWeight: 800,
                  fontSynthesis: "none",
                  textShadow: "0 6px 12px rgba(0,0,0,0.6)",
                  WebkitTextStroke: "3px rgb(255, 255, 255)",
                }}
              >
                СКОРО
              </div>
            </div>
          </div>
        )}
      </div>

    {/* НАЗВАНИЕ + ЦЕНА показываются только если НЕ "скоро" */}
    {!isSoon && (
      <div className="mt-[-5px] md:mt-5">
        <div
          className="text-[18px] sm:text-[20px] md:text-[30px] leading-none"
          style={{ fontFamily: "Yeast" }}
        >
          {title}
        </div>

        <div
          className="mt-2 text-[18px] sm:text-[16px] md:text-[25px] leading-none"
          style={{ fontFamily: "Yeast" }}
        >
          {(price / 100).toFixed(0)}р
        </div>
      </div>
    )}

    </Wrapper>
  );
}
