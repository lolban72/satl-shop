import { signOut } from "@/auth";

export const metadata = {
  title: "Выход из личного кабинета | SATL",
};

export async function POST() {
  await signOut({ redirectTo: "/" });
}
