"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    setLoading(false);

    if (data?.resetUrl) {
      setMsg(`Ссылка для сброса (тест): ${data.resetUrl}`);
    } else {
      setMsg("Если email существует — ссылка отправлена.");
    }
  }

  return (
    <div className="max-w-[400px] mx-auto pt-20">
      <h1 className="text-xl font-bold mb-6">Сброс пароля</h1>

      <form onSubmit={submit} className="space-y-4">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border px-3 py-2"
        />

        <button
          disabled={loading}
          className="w-full bg-black text-white py-2"
        >
          {loading ? "Отправляю..." : "Сбросить пароль"}
        </button>
      </form>

      {msg && (
        <div className="mt-4 text-sm break-all">{msg}</div>
      )}
    </div>
  );
}