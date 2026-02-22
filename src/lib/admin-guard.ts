import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || !isAdmin(session)) {
    return null;
  }
  return session;
}