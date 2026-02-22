"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="rounded-xl bg-black px-3 py-1.5 text-sm text-white"
      onClick={async () => {
        // signOut удалит сессионные cookies
        await signOut({ redirect: false });
        // форсим обновление серверных компонентов (Navbar)
        router.refresh();
        // можно ещё увести на главную
        router.push("/");
      }}
    >
      Выйти
    </button>
  );
}
