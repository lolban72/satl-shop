"use client";

import { useEffect, useState } from "react";

type Step = "password" | "code";

export default function ChangePasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("password");

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [code, setCode] = useState("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // esc close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // reset on open
  useEffect(() => {
    if (!open) return;
    setStep("password");
    setPassword("");
    setPassword2("");
    setCode("");
    setErr(null);
    setOk(null);
    setSaving(false);
  }, [open]);

  if (!open) return null;

  async function submitPasswordStep() {
    setErr(null);
    setOk(null);

    if (password.length < 6) {
      setErr("Пароль должен быть не короче 6 символов");
      return;
    }
    if (password !== password2) {
      setErr("Пароли не совпадают");
      return;
    }

    setSaving(true);
    try {
      // ✅ отправляем код в TG (сервер сам проверит, привязан ли Telegram)
      const res = await fetch("/api/account/change-password/request-code", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Не удалось отправить код");

      setStep("code");
      setOk("Код отправлен в Telegram. Введите его ниже.");
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function submitCodeStep() {
    setErr(null);
    setOk(null);

    const c = code.trim();
    if (!c) {
      setErr("Введи код");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/account/change-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Не удалось подтвердить код");

      setOk("Пароль изменён ✅");
      // можно закрыть через небольшую паузу
      setTimeout(() => onClose(), 600);
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function resend() {
    setErr(null);
    setOk(null);

    setSaving(true);
    try {
      const res = await fetch("/api/account/change-password/request-code", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Не удалось отправить код");

      setOk("Код отправлен повторно в Telegram.");
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200]">
      {/* backdrop */}
      <button
        aria-label="Закрыть"
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />

      {/* modal */}
      <div className="absolute left-1/2 top-1/2 w-[420px] -translate-x-1/2 -translate-y-1/2 bg-white border border-black/15 p-[18px]">
        <div className="text-center font-semibold italic text-[22px] text-black">
          Смена пароля
        </div>

        {step === "password" ? (
          <div className="mt-[16px] grid justify-items-center gap-[14px]">
            <label className="block">
              <div className="mb-[6px] font-semibold text-[10px] text-black/70">
                Новый пароль
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-[35px] w-[330px] border border-black/15 px-[10px] font-semibold text-[12px] outline-none focus:border-black/40"
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
                className="h-[35px] w-[330px] border border-black/15 px-[10px] font-semibold text-[12px] outline-none focus:border-black/40"
              />
            </label>

            <button
              type="button"
              disabled={saving}
              onClick={submitPasswordStep}
              className="mt-[6px] h-[30px] w-[180px] bg-black text-white flex items-center justify-center text-[10px] font-bold uppercase tracking-[0.12em] hover:bg-black/85 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="mt-[2px]">{saving ? "Отправляю..." : "Продолжить"}</div>
            </button>
          </div>
        ) : (
          <div className="mt-[16px] grid justify-items-center gap-[14px]">
            <label className="block">
              <div className="mb-[6px] font-semibold text-[8px] text-black/70">
                Код подтверждения
              </div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-[35px] w-[330px] border border-black/15 px-[10px] font-semibold text-[12px] outline-none focus:border-black/40"
              />
            </label>

            <div className="flex w-[330px] items-center justify-between text-[10px] text-black/45">
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
              onClick={submitCodeStep}
              className="mt-[6px] h-[30px] w-[180px] bg-black text-white flex items-center justify-center text-[10px] font-bold uppercase tracking-[0.12em] hover:bg-black/85 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Проверяю..." : "Подтвердить"}
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

        <div className="mt-[14px] flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] uppercase tracking-[0.12em] text-black/45 hover:text-black transition"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}