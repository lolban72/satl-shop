import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

type Item = { label: string; href: string };

async function ensureRow() {
  const existing = await prisma.siteSettings.findUnique({ where: { id: "main" } });
  if (existing) return existing;

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

function asList(v: any): Item[] {
  return Array.isArray(v) ? (v as any[]).map((x) => ({
    label: String(x?.label ?? ""),
    href: String(x?.href ?? ""),
  })) : [];
}

export default async function AdminContactsSettingsPage() {
  const row = await ensureRow();
  const left = asList(row.contactsLeft);
  const right = asList(row.contactsRight);

  async function saveAction(formData: FormData) {
    "use server";

    const rawLeft = String(formData.get("left") ?? "[]");
    const rawRight = String(formData.get("right") ?? "[]");

    let leftParsed: any = [];
    let rightParsed: any = [];
    try { leftParsed = JSON.parse(rawLeft); } catch {}
    try { rightParsed = JSON.parse(rawRight); } catch {}

    const norm = (arr: any[]) =>
      (Array.isArray(arr) ? arr : [])
        .map((x) => ({
          label: String(x?.label ?? "").trim(),
          href: String(x?.href ?? "").trim() || "#",
        }))
        .filter((x) => x.label.length > 0);

    await prisma.siteSettings.update({
      where: { id: "main" },
      data: {
        contactsLeft: norm(leftParsed),
        contactsRight: norm(rightParsed),
      },
    });

    redirect("/admin/settings/contacts");
  }

  return (
    <div className="min-w-0">
      <div className="mb-4">
        <div className="text-xl font-semibold">Настройки — Контакты в футере</div>
        <div className="text-sm text-black/55">Редактируй название и ссылку. Пустые названия удаляются.</div>
      </div>

      {/* максимально просто: редактируем JSON списки */}
      <form action={saveAction} className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border p-4">
          <div className="text-sm font-semibold mb-2">Левая колонка</div>
          <textarea
            name="left"
            defaultValue={JSON.stringify(left, null, 2)}
            className="h-[420px] w-full rounded-xl border p-3 font-mono text-[12px] outline-none"
          />
        </div>

        <div className="rounded-2xl border p-4">
          <div className="text-sm font-semibold mb-2">Правая колонка</div>
          <textarea
            name="right"
            defaultValue={JSON.stringify(right, null, 2)}
            className="h-[420px] w-full rounded-xl border p-3 font-mono text-[12px] outline-none"
          />
        </div>

        <div className="lg:col-span-2 flex justify-end">
          <button className="h-10 rounded-xl bg-black px-5 text-sm font-semibold text-white">
            Сохранить
          </button>
        </div>
      </form>

      <div className="mt-4 text-[12px] text-black/60">
        Формат элемента: <span className="font-mono">{`{ "label": "телеграм", "href": "https://..." }`}</span>
        <br />
        Поддержка: <span className="font-mono">https://</span>, <span className="font-mono">mailto:</span>, <span className="font-mono">tel:</span>
      </div>
    </div>
  );
}