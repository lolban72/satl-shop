"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { useCart } from "../lib/cart-store";

export default function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useCart((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return <SessionProvider>{children}</SessionProvider>;
}
