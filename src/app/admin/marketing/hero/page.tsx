import { auth } from "@/auth";
import { redirect } from "next/navigation";
import HeroBannerEditor from "./ui/HeroBannerEditor";

export default async function AdminHeroPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Маркетинг — Hero баннер</h1>
      <div className="mt-6 rounded-2xl border p-4">
        <HeroBannerEditor />
      </div>
    </div>
  );
}
