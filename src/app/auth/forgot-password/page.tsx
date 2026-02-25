"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Step = "request" | "reset";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("request");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    setOk(null);
  }, [step]);

  async function requestCode() {
    setErr(null);
    setOk(null);

    const e = email.trim().toLowerCase();
    if (!e) return setErr("Введи email");

    setSaving(true);
    try {
      const res = await fetch("/api/auth/forgot-password/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e }),
      });
      const data = await res.json().catch(() => ({}));

      // даже если email не найден / TG не привязан — сервер вернёт ok:true (без раскрытия)
      if (!res.ok) throw new Error(data?.error || "Не удалось отправить код");

      setStep("reset");
      setOk("Если аккаунт существует и Telegram привязан — код отправлен в Telegram.");
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function resend() {
    setErr(null);
    setOk(null);

    const e = email.trim().toLowerCase();
    if (!e) return setErr("Введи email");

    setSaving(true);
    try {
      const res = await fetch("/api/auth/forgot-password/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Не удалось отправить код");

      setOk("Код отправлен повторно (если Telegram привязан).");
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function confirm() {
    setErr(null);
    setOk(null);

    const e = email.trim().toLowerCase();
    const c = code.trim();

    if (!e) return setErr("Введи email");
    if (!c) return setErr("Введи код");
    if (password.length < 6) return setErr("Пароль должен быть не короче 6 символов");
    if (password !== password2) return setErr("Пароли не совпадают");

    setSaving(true);
    try {
      const res = await fetch("/api/auth/forgot-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, code: c, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Не удалось подтвердить код");

      setOk("Пароль изменён ✅ Через 5 секунд вы будете перенаправлены на страницу входа.");

      setTimeout(() => {
        router.push("/auth/login");
      }, 5000);
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] flex items-center justify-center px-[16px]">
      <div className="w-full max-w-[460px] bg-white border border-black/15 p-[18px]">
        <div className="text-center font-semibold italic text-[22px] text-black">
          Восстановление пароля
        </div>

        {step === "request" ? (
          <div className="mt-[16px] grid gap-[14px]">
            <label className="block">
              <div className="mb-[6px] font-semibold text-[10px] text-black/70">
                Email
              </div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-[35px] w-full border border-black/15 px-[10px] font-semibold text-[12px] outline-none focus:border-black/40"
                placeholder="example@mail.com"
              />
            </label>

            <button
              type="button"
              disabled={saving}
              onClick={requestCode}
              className="h-[30px] w-full bg-black text-white flex items-center justify-center text-[10px] font-bold uppercase tracking-[0.12em] hover:bg-black/85 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="mt-[2px]">{saving ? "Отправляю..." : "Отправить код в Telegram"}</div>
            </button>

            <div className="flex justify-center">
              <Link
                href="/auth/login"
                className="text-[10px] uppercase tracking-[0.12em] text-black/45 hover:text-black transition"
              >
                Вернуться ко входу
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-[16px] grid gap-[14px]">
            <label className="block">
              <div className="mb-[6px] font-semibold text-[10px] text-black/70">
                Email
              </div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-[35px] w-full border border-black/15 px-[10px] font-semibold text-[12px] outline-none focus:border-black/40"
              />
            </label>

            <label className="block">
              <div className="mb-[6px] font-semibold text-[8px] text-black/70">
                Код из Telegram
              </div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-[35px] w-full border border-black/15 px-[10px] font-semibold text-[12px] outline-none focus:border-black/40"
              />
            </label>

            <label className="block">
              <div className="mb-[6px] font-semibold text-[10px] text-black/70">
                Новый пароль
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-[35px] w-full border border-black/15 px-[10px] font-semibold text-[12px] outline-none focus:border-black/40"
              />
            </label>

            <label className="block">
              <div className="mb-[6px] font-semibold text-[10px] text-black/70">
                Повтори пароль
              </div>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="h-[35px] w-full border border-black/15 px-[10px] font-semibold text-[12px] outline-none focus:border-black/40"
              />
            </label>

            <div className="flex items-center justify-between text-[10px] text-black/45">
              <button
                type="button"
                className="hover:text-black transition disabled:opacity-40"
                disabled={saving}
                onClick={() => setStep("request")}
              >
                Назад
              </button>

              <button
                type="button"
                className="hover:text-black transition disabled:opacity-40"
                disabled={saving}
                onClick={resend}
              >
                Отправить код снова
              </button>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={confirm}
              className="h-[30px] w-full bg-black text-white flex items-center justify-center text-[10px] font-bold uppercase tracking-[0.12em] hover:bg-black/85 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Проверяю..." : "Сменить пароль"}
            </button>
          </div>
        )}

        {err ? (
          <div className="mt-[12px] text-center text-[11px] text-[#B60404]">
            {err}
          </div>
        ) : null}
        {ok ? (
          <div className="mt-[12px] text-center text-[11px] text-black/70">
            {ok}
          </div>
        ) : null}
      </div>
    </div>
  );
}