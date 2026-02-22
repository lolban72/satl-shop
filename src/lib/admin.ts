import type { Session } from "next-auth";

function parseList(v?: string) {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(session: Session | null) {
  const email = session?.user?.email?.toLowerCase().trim();
  if (!email) return false;

  const admins = parseList(process.env.ADMIN_EMAILS);
  return admins.includes(email);
}