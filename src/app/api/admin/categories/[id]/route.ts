import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

function parseAdminEmails(v?: string) {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email?: string | null) {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  const admins = parseAdminEmails(process.env.ADMIN_EMAILS);
  return admins.includes(e);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  // ✅ защита админского API
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params; // ✅ важно
  const body = await req.json();

  const updated = await prisma.category.update({
    where: { id },
    data: {
      title: body.title ?? undefined,
      slug: body.slug ?? undefined,
      navOrder: typeof body.navOrder === "number" ? body.navOrder : undefined,
      homeOrder: typeof body.homeOrder === "number" ? body.homeOrder : undefined,
      showInNav: typeof body.showInNav === "boolean" ? body.showInNav : undefined,
      showOnHome: typeof body.showOnHome === "boolean" ? body.showOnHome : undefined,
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/navigation/header");
  revalidatePath("/admin/navigation/home");

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  // ✅ защита админского API
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params; // ✅ важно

  await prisma.category.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/navigation/header");
  revalidatePath("/admin/navigation/home");

  return NextResponse.json({ ok: true });
}