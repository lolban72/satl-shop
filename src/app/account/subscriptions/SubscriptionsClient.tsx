"use client";

import Link from "next/link";
import { useState } from "react";

export default function SubscriptionsClient({
  initialEnabled,
  tgLinked,
}: {
  initialEnabled: boolean;
  tgLinked: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setOk(null);
    setErr(null);

    if (!tgLinked) {
      setErr("Чтобы получать рассылку, сначала привяжите Telegram-аккаунт.");
      return;
    }

    setEnabled(next); // optimistic
    setSaving(true);

    try {
      const res = await fetch("/api/account/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsletterEnabled: next }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Не удалось сохранить");

      setOk(next ? "Рассылка в Telegram включена ✅" : "Рассылка выключена ✅");
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
      setEnabled(!next); // rollback
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="text-center font-semibold italic text-[20px] text-black">
        Подписки
      </div>

      <div className="mt-[18px] flex flex-col items-center gap-[10px]">
        <div className="text-[13px] text-black/70 text-center max-w-[520px]">
          Включите рассылку, чтобы получать информацию о заказах, новости о новых товарах, скидках и релизах{" "}
        </div>

        {!tgLinked ? (
          <div className="mt-[6px] text-[11px] text-black/55 text-center max-w-[520px]">
            Telegram ещё не привязан.{" "}
            <Link href="/auth/verify" className="underline hover:text-black transition">
              Перейти к привязке
            </Link>
          </div>
        ) : null}

        <button
          type="button"
          disabled={saving || !tgLinked}
          onClick={() => toggle(!enabled)}
          className={[
            "mt-[10px] h-[30px] w-[330px] border border-black/15",
            "flex items-center justify-between px-[12px]",
            "text-[10px] font-bold uppercase tracking-[0.12em]",
            "transition hover:border-black/40 disabled:opacity-40 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          <span>Рассылка в Телеграм</span>

          {/* switch */}
          <span
            className={[
              "relative inline-flex h-[18px] w-[36px] items-center",
              "border border-black/20",
              enabled ? "bg-black" : "bg-white",
              "transition",
            ].join(" ")}
            aria-hidden="true"
          >
            <span
              className={[
                "absolute top-1/2 h-[12px] w-[12px] -translate-y-1/2",
                "bg-white border border-black/20 transition",
                enabled ? "left-[20px]" : "left-[4px]",
              ].join(" ")}
            />
          </span>
        </button>

        {err ? (
          <div className="mt-[10px] text-center text-[11px] text-[#B60404]">
            {err}
          </div>
        ) : null}

        {ok ? (
          <div className="mt-[10px] text-center text-[11px] text-black/70">
            {ok}
          </div>
        ) : null}
      </div>
    </div>
  );
}