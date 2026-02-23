"use client";

export const metadata = {
  title: "Верификация аккаунта | SATL",
};

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-[6px] text-[9px] font-semibold uppercase tracking-[0.08em] text-black/60">
      {children}
    </div>
  );
}

function Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }
) {
  const { hasError, className, ...rest } = props;
  return (
    <input
      {...rest}
      className={[
        "h-[42px] w-full border px-[12px]",
        "text-[13px] font-semibold outline-none",
        "placeholder:text-black/35",
        "focus:border-black/40 transition",
        hasError ? "border-red-400" : "border-black/15",
        className ?? "",
      ].join(" ")}
    />
  );
}

export default function VerifyTgPage() {
  const router = useRouter();

  const botLink = useMemo(() => {
    return (process.env.NEXT_PUBLIC_TG_BOT_URL || "").trim();
  }, []);

  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copyOk, setCopyOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function generateCode() {
    setErr(null);
    setCopyOk(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/tg-link-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Не удалось сгенерировать код");

      setCode(String(data?.code || ""));
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!code) return;
    setCopyOk(null);
    try {
      await navigator.clipboard.writeText(code);
      setCopyOk("Скопировано ✅");
      setTimeout(() => setCopyOk(null), 1200);
    } catch {
      setCopyOk("Не удалось скопировать");
      setTimeout(() => setCopyOk(null), 1200);
    }
  }

  return (
    <div className="min-h-screen px-4 sm:px-8 md:px-[65px] pt-10 sm:pt-[70px] pb-20 sm:pb-[140px]">
      <div className="mx-auto w-full max-w-[420px]">
        <div className="text-center text-[18px] sm:text-[20px] font-semibold uppercase tracking-[-0.02em] text-black">
          Подтверждение
        </div>

        <div className="mt-6 grid gap-6">
          <button
            onClick={generateCode}
            disabled={loading}
            className={[
              "h-[42px] w-full bg-black text-white",
              "text-[11px] font-bold uppercase tracking-[0.12em]",
              "hover:bg-black/85 transition active:scale-[0.98]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            ].join(" ")}
          >
            {loading ? "ГЕНЕРИРУЮ..." : "Сгенерировать код"}
          </button>

          <div>
            <Label>Ваш код</Label>
            <div className="flex gap-2">
              <Input
                value={code}
                readOnly
                placeholder="Сначала сгенерируйте код"
                hasError={!!err}
              />
              <button
                type="button"
                onClick={copy}
                disabled={!code}
                className={[
                  "h-[42px] px-4 border text-[10px] font-bold uppercase tracking-[0.12em]",
                  "transition",
                  code
                    ? "hover:bg-gray-50 border-black/20"
                    : "opacity-50 cursor-not-allowed border-black/10",
                ].join(" ")}
              >
                Скопировать
              </button>
            </div>
            <div className="mt-3 text-[11px] leading-[1.5] text-black/55">
              Отправьте код боту — аккаунт привяжется автоматически 
            </div>

            {copyOk ? (
              <div className="mt-2 text-[11px] text-black/55">{copyOk}</div>
            ) : null}
          </div>

          <a
            href={botLink || "#"}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!botLink}
            className={[
              "inline-flex h-[42px] w-full items-center justify-center",
              "bg-black text-white text-[11px] font-bold uppercase tracking-[0.12em]",
              "transition",
              botLink
                ? "hover:bg-black/85"
                : "opacity-50 pointer-events-none",
            ].join(" ")}
          >
            Открыть телеграм-бота
          </a>
        </div>

        {err ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
            {err}
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between text-[10px] uppercase tracking-[0.08em] text-black/45">
          <Link href="/" className="hover:text-black/70 transition">
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}