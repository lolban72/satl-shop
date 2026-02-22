"use client";

export default function TopMarquee({
  text = "СКИДКИ 20%",
  speedSeconds = 10,
  fontClass = "",
}: {
  text?: string;
  speedSeconds?: number;
  fontClass?: string;
}) {
  const repeats = 18;

  const Item = () => (
    <span className="inline-flex items-center gap-6 whitespace-nowrap">
      <span>{text}</span>
      <span aria-hidden="true">•</span>
    </span>
  );

  // 👇 добавляем флаг isSecond
  const Track = ({
    ariaHidden,
    isSecond,
  }: {
    ariaHidden?: boolean;
    isSecond?: boolean;
  }) => (
    <div
      className={`
        ${fontClass}
        flex w-max items-center gap-6
        ${isSecond ? "pl-0 pr-6" : "px-6"}
        text-[15px] font-medium uppercase tracking-[-0.11em]
      `}
      aria-hidden={ariaHidden}
    >
      {Array.from({ length: repeats }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  );

  return (
    <div className="h-[30px] border-b bg-white">
      <div className="relative h-full overflow-hidden">
        <div
          className="flex h-full w-max"
          style={{
            animation: `satl-marquee ${speedSeconds}s linear infinite`,
            willChange: "transform",
          }}
        >
          {/* первый трек — с padding */}
          <Track />

          {/* второй трек — без левого padding */}
          <Track ariaHidden isSecond />
        </div>

        <style jsx>{`
          @keyframes satl-marquee {
            from {
              transform: translateX(0);
            }
            to {
              transform: translateX(-50%);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
