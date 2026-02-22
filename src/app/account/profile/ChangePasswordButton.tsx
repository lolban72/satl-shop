"use client";

import { useState } from "react";
import ChangePasswordModal from "../ui/ChangePasswordModal";

export default function ChangePasswordButton({
  className = "",
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`
          bg-black text-white
          flex items-center justify-center
          text-[12px] font-semibold uppercase tracking-[0.02em]
          transition hover:bg-black/85
          ${className}
        `}
      >
        Сменить пароль
      </button>

      <ChangePasswordModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
