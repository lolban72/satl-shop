"use client";

import { useEffect } from "react";

export default function PrintOnLoad() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 250);
    return () => clearTimeout(t);
  }, []);
  return null;
}