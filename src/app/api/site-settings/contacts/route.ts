import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ContactItem = { label: string; href: string };
type ContactsPayload = { left: ContactItem[]; right: ContactItem[] };

function normItem(x: any): ContactItem | null {
  const label = String(x?.label ?? "").trim();
  const href = String(x?.href ?? "").trim();
  if (!label) return null;
  // href может быть "#" / "mailto:" / "tel:" / https:// ...
  return { label, href: href || "#" };
}

function normList(list: any): ContactItem[] {
  const arr = Array.isArray(list) ? list : [];
  return arr.map(normItem).filter(Boolean) as ContactItem[];
}

async function ensureRow() {
  const existing = await prisma.siteSettings.findUnique({ where: { id: "main" } });
  if (existing) return existing;

  // дефолты как у тебя в футере
  return prisma.siteSettings.create({
    data: {
      id: "main",
      contactsLeft: [
        { label: "телеграм", href: "https://web.telegram.org/k/#@MANAGER_SATL_SHOP" },
        { label: "почта", href: "mailto:Satl.Shop.ru@gmail.com" },
        { label: "тикток", href: "#" },
      ],
      contactsRight: [
        { label: "инстаграм", href: "#" },
        { label: "телефон", href: "tel:+70000000000" },
        { label: "вк", href: "#" },
      ],
    },
  });
}

// GET: отдать контакты
export async function GET() {
  const row = await ensureRow();

  return Response.json({
    left: Array.isArray(row.contactsLeft) ? row.contactsLeft : [],
    right: Array.isArray(row.contactsRight) ? row.contactsRight : [],
  });
}

// POST: сохранить контакты
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as ContactsPayload | null;
  if (!body) return Response.json({ error: "Bad JSON" }, { status: 400 });

  const left = normList((body as any).left);
  const right = normList((body as any).right);

  await ensureRow();

  await prisma.siteSettings.update({
    where: { id: "main" },
    data: { contactsLeft: left, contactsRight: right },
  });

  return Response.json({ ok: true });
}