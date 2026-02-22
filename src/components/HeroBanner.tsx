import Link from "next/link";

export default function HeroBanner({
  banner,
}: {
  banner: {
    enabled: boolean;
    title: string;
    subtitle?: string | null;
    buttonText?: string | null;
    buttonHref?: string | null;
    imageDesktop?: string | null;
    imageMobile?: string | null;
    overlay: number;
  } | null;
}) {
  if (!banner || !banner.enabled) return null;

  const HEADER_HEIGHT = 80; // твоя sticky-шапка
  const overlay = Math.min(100, Math.max(0, banner.overlay ?? 25));

  const hasImage = Boolean(banner.imageDesktop || banner.imageMobile);

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        height: `calc(100vh - ${HEADER_HEIGHT}px)`,
      }}
    >
      {/* BACKGROUND */}
      {hasImage ? (
        <>
          <picture>
            {/* мобилка */}
            {banner.imageMobile ? (
              <source media="(max-width: 767px)" srcSet={banner.imageMobile} />
            ) : null}

            {/* десктоп */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={banner.imageDesktop ?? banner.imageMobile ?? ""}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
          </picture>

          <div
            className="absolute inset-0 bg-black"
            style={{ opacity: overlay / 100 }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-white to-gray-100" />
      )}

      {/* CONTENT */}
      <div className="relative flex h-full items-center">
        <div className="mx-auto w-full max-w-[1440px] px-[65px]">
          {/* если у тебя текст должен быть белым на фоне — поменяй на text-white */}
          <div className="max-w-xl text-black">
            <h1 className="font-bold text-[65px] leading-[0.95] tracking-[-0.19em]">
              {banner.title}
            </h1>

            {banner.subtitle ? (
              <p className="mt-6 text-[16px] text-black/80">{banner.subtitle}</p>
            ) : null}

            {banner.buttonText && banner.buttonHref ? (
              <div className="mt-8">
                <Link
                  href={banner.buttonHref}
                  className="inline-flex items-center rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
                >
                  {banner.buttonText}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
