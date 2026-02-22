"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-[6px] text-[8px] font-semibold uppercase tracking-[0.06em] text-black/60">
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
        "h-[35px] w-[330px] border px-[10px]",
        "text-[12px] font-semibold outline-none",
        "placeholder:text-black/35",
        "focus:border-black/40 transition",
        hasError ? "border-red-400" : "border-black/15",
        className ?? "",
      ].join(" ")}
    />
  );
}

export default function LoginEmailPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const eMail = email.trim();
    if (!eMail) return setErr("Введите e-mail");
    if (!password) return setErr("Введите пароль");

    setSaving(true);
    try {
      // redirect:false — чтобы мы сами сделали router.push
      const res = await signIn("credentials", {
        email: eMail,
        password,
        redirect: false,
      });

      if (!res) {
        setErr("Ошибка входа");
        return;
      }
      if (res.error) {
        setErr("Неверный e-mail или пароль");
        return;
      }

      const callbackUrl = sp.get("callbackUrl") || "/account/orders";
      router.push(callbackUrl);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-[65px] pt-[70px] pb-[140px]">
      <div className="flex justify-center">
        <div className="w-[330px]">
          <div className="text-start text-[20px] font-semibold uppercase tracking-[-0.02em] text-black">
            ВОЙТИ В АККАУНТ
          </div>

          {err ? (
            <div className="mt-[14px] rounded-md border border-red-200 bg-red-50 p-3 text-[11px] text-red-700">
              {err}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-[18px]">
            <div className="grid gap-[12px]">
              <label className="block">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  hasError={!!err && !email.trim()}
                />
              </label>

              <label className="block">
                <Label>Пароль</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  hasError={!!err && !password}
                />
              </label>
            </div>

            <div className="mt-[14px] flex items-center justify-between">
              <button
                type="submit"
                disabled={saving}
                className={[
                  "h-[35px] w-[160px] bg-black text-white",
                  "text-[10px] font-bold uppercase tracking-[0.12em]",
                  "hover:bg-black/85 transition active:scale-[0.98]",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                ].join(" ")}
              >
                {saving ? "ВХОД..." : "ВОЙТИ"}
              </button>

              <Link
                href="/auth/forgot-password"
                className="text-[8px] uppercase tracking-[0.08em] text-black/65 hover:text-black/100 transition"
              >
                Забыли пароль?
              </Link>
            </div>
          </form>

          <div className="mt-[18px]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-black">
              НЕТ АККАУНТА?
            </div>

            <div className="mt-[6px] text-[10px] leading-[1.2] text-black/55">
              Создайте учетную запись, чтобы легко отслеживать статус заказа
            </div>

            <Link
              href="/auth/register"
              className={[
                "mt-[10px] inline-flex items-center justify-center",
                "h-[35px] w-[160px] border border-black/25",
                "text-[9px] font-semibold uppercase tracking-[0.08em] text-black/75",
                "hover:border-black/45 hover:text-black transition",
              ].join(" ")}
            >
              ЗАРЕГИСТРИРОВАТЬСЯ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
