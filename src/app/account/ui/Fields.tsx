"use client";

export function Title({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center font-semibold italic text-[20px] text-black">
      {children}
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-[6px] font-semibold text-[8px] text-black/70">
      {children}
    </div>
  );
}

export function Input({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-[35px] w-[330px] border border-black/15 px-[10px] font-semibold text-[12px] outline-none focus:border-black/40"
    />
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "h-[30px] w-[180px] bg-black text-white flex items-center justify-center",
        "text-[12px] font-bold uppercase tracking-[0.12em] transition",
        "hover:bg-black/85 disabled:opacity-40 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
