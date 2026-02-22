"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState(""); // UI only
  const [country, setCountry] = useState("Российская Федерация"); // UI only
  const [phone, setPhone] = useState(""); // UI only

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [agree, setAgree] = useState(false);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    const eMail = email.trim().toLowerCase();
    const n = name.trim();

    // ✅ name теперь НЕ обязателен (можно пустым)
    if (!eMail) return setErr("Введите e-mail");
    if (password.length < 6) return setErr("Пароль минимум 6 символов");
    if (password !== password2) return setErr("Пароли не совпадают");
    if (!agree) return setErr("Нужно дать согласие на обработку данных");

    setSaving(true);
    try {
      // 1) регистрация
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: eMail,
          password,
          // ✅ отправляем name только если он не пустой (иначе вообще не шлём)
          ...(n ? { name: n } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error || "Ошибка регистрации");
        return;
      }

      // ✅ если сервер вернул код (devCode) — сохраняем, чтобы показать на verify странице (для теста)
      // (потом можно убрать, когда будет TG-бот)
      if (data?.devCode) {
        try {
          localStorage.setItem("satl_verify_dev_code", String(data.devCode));
        } catch {}
      }

      // 2) сразу логиним
      const login = await signIn("credentials", {
        email: eMail,
        password,
        redirect: false,
      });

      if (login?.error) {
        setOk("Аккаунт создан. Теперь войдите ✅");
        router.push("/auth/login");
        return;
      }

      // ✅ после успешного логина — на страницу подтверждения
      router.push("/auth/verify");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-[65px] pt-[70px] pb-[140px]">
      <div className="flex justify-center">
        <div className="w-[330px]">
          <div className="text-center text-[20px] font-semibold uppercase tracking-[-0.02em] text-black">
            РЕГИСТРАЦИЯ
          </div>

          {err ? (
            <div className="mt-[14px] rounded-md border border-red-200 bg-red-50 p-3 text-[11px] text-red-700">
              {err}
            </div>
          ) : null}
          {ok ? (
            <div className="mt-[14px] rounded-md border border-green-200 bg-green-50 p-3 text-[11px] text-green-700">
              {ok}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-[18px]">
            <div className="grid gap-[12px]">
              <label className="block">
                <Label>Имя (необязательно)</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <label className="block">
                <Label>Фамилия</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </label>

              <label className="block">
                <Label>Страна</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value)} />
              </label>

              <label className="block">
                <Label>Телефон</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
              </label>

              <label className="block">
                <Label>E-mail</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  hasError={!!err && !email.trim()}
                />
              </label>

              <label className="block">
                <Label>Пароль</Label>
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  hasError={!!err && password.length < 6}
                />
              </label>

              <label className="block">
                <Label>Подтвердите пароль</Label>
                <Input
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  type="password"
                  hasError={!!err && password2 !== password}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className={[
                "mt-[14px] h-[35px] w-[160px] bg-black text-white",
                "text-[9px] font-bold uppercase tracking-[0.12em]",
                "hover:bg-black/85 transition active:scale-[0.98]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {saving ? "СОЗДАЮ..." : "ЗАРЕГИСТРИРОВАТЬСЯ"}
            </button>

            <label className="mt-[12px] flex items-start gap-[10px]">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-[7px] h-[12px] w-[12px] border border-black/40"
              />

              <span className="text-[9px] leading-[1.6] text-black/55">
                Я даю{" "}
                <Link
                  href="/legal/consent"
                  target="_blank"
                  className="border-b border-black/40 text-black hover:border-black transition"
                >
                  согласие
                </Link>{" "}
                на обработку моих персональных данных в соответствии с{" "}
                <Link
                  href="/docs/pd-policy"
                  target="_blank"
                  className="border-b border-black/40 text-black hover:border-black transition"
                >
                  политикой обработки персональных данных
                </Link>
              </span>
            </label>
          </form>

          <div className="mt-[14px]">
            <Link
              href="/auth/login"
              className="text-[8px] uppercase tracking-[0.08em] text-black/45 hover:text-black/70 transition"
            >
              Уже есть аккаунт? Войти
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
