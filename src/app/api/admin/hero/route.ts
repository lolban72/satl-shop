import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

// ✅ title теперь НЕ обязателен: допускаем "", null, undefined
const PatchSchema = z.object({
  enabled: z.boolean(),
  title: z.string().optional().nullable().default(""),
  subtitle: z.string().optional().nullable(),
  buttonText: z.string().optional().nullable(),
  buttonHref: z.string().optional().nullable(),
  imageDesktop: z.string().optional().nullable(),
  imageMobile: z.string().optional().nullable(),
  overlay: z.number().int().min(0).max(100),
});

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
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let banner = await prisma.heroBanner.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!banner) {
    banner = await prisma.heroBanner.create({
      data: {
        enabled: false,
        title: "", // ✅ пустой допустим
        subtitle: null,
        buttonText: null,
        buttonHref: null,
        imageDesktop: null,
        imageMobile: null,
        overlay: 25,
      },
    });
  }

  return Response.json(banner);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = PatchSchema.parse(await req.json());

    // ✅ нормализуем строки: если пришли пробелы — считаем пустым
    const title = (body.title ?? "").trim();
    const subtitle = (body.subtitle ?? "").trim() || null;
    const buttonText = (body.buttonText ?? "").trim() || null;
    const buttonHref = (body.buttonHref ?? "").trim() || null;

    const existing = await prisma.heroBanner.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    const updated = existing
      ? await prisma.heroBanner.update({
          where: { id: existing.id },
          data: {
            enabled: body.enabled,
            title, // ✅ может быть ""
            subtitle,
            buttonText,
            buttonHref,
            imageDesktop: body.imageDesktop ?? null,
            imageMobile: body.imageMobile ?? null,
            overlay: body.overlay,
          },
        })
      : await prisma.heroBanner.create({
          data: {
            enabled: body.enabled,
            title, // ✅ может быть ""
            subtitle,
            buttonText,
            buttonHref,
            imageDesktop: body.imageDesktop ?? null,
            imageMobile: body.imageMobile ?? null,
            overlay: body.overlay,
          },
        });

    revalidatePath("/");
    revalidatePath("/admin");

    return Response.json(updated);
  } catch (e: any) {
    const msg = e?.issues?.[0]?.message || e?.message || "Ошибка";
    return Response.json({ error: msg }, { status: 400 });
  }
}