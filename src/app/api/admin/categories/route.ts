import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "");
}

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

export async function GET() {
  // ✅ защита админского API
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const categories = await prisma.category.findMany({
    orderBy: [
      { navOrder: "asc" },
      { homeOrder: "asc" },
      { createdAt: "desc" },
    ],
  });

  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  // ✅ защита админского API
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  const title = String(body.title ?? "").trim();
  const slug = String(body.slug ?? "").trim() || slugify(title);

  const navOrder = Number(body.navOrder ?? 0);
  const homeOrder = Number(body.homeOrder ?? 0);

  const showInNav =
    typeof body.showInNav === "boolean" ? body.showInNav : true;

  const showOnHome =
    typeof body.showOnHome === "boolean" ? body.showOnHome : true;

  if (!title) {
    return NextResponse.json(
      { error: "Название обязательно" },
      { status: 400 }
    );
  }

  const created = await prisma.category.create({
    data: { title, slug, navOrder, homeOrder, showInNav, showOnHome },
  });

  return NextResponse.json(created);
}