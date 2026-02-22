"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AuthControls() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Пока грузится — можно показывать заглушку, чтобы не мигало
  if (status === "loading") {
    return <div className="h-9 w-[110px] rounded-xl border" />;
  }

  if (!session?.user) {
    return (
      <Link href="/auth/login" className="rounded-xl border px-3 py-1.5 text-sm">
        Войти
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/account" className="rounded-xl border px-3 py-1.5 text-sm">
        {session.user.name ?? session.user.email}
      </Link>

      <button
        type="button"
        className="rounded-xl bg-black px-3 py-1.5 text-sm text-white"
        onClick={async () => {
          await signOut({ redirect: false });
          router.refresh(); // на всякий — обновит server pages, если нужно
          router.push("/");
        }}
      >
        Выйти
      </button>
    </div>
  );
}
