"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordPage() {
  const token = useSearchParams().get("token");
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();

    if (data.ok) {
      setMsg("Пароль изменён. Перенаправляю...");
      setTimeout(() => router.push("/auth/login"), 1500);
    } else {
      setMsg(data.error);
    }
  }

  return (
    <div className="max-w-[400px] mx-auto pt-20">
      <h1 className="text-xl font-bold mb-6">Новый пароль</h1>

      <form onSubmit={submit} className="space-y-4">
        <input
          type="password"
          required
          placeholder="Новый пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border px-3 py-2"
        />

        <button className="w-full bg-black text-white py-2">
          Сохранить
        </button>
      </form>

      {msg && <div className="mt-4 text-sm">{msg}</div>}
    </div>
  );
}