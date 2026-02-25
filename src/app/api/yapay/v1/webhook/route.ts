import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    console.log("✅ YAPAY WEBHOOK HIT");
    console.log("headers:", Object.fromEntries(req.headers.entries()));
    console.log("body:", raw);

    const json = raw ? JSON.parse(raw) : null;

    // ⚠️ ниже мы делаем максимально универсально:
    const orderId =
      json?.orderId ||
      json?.data?.orderId ||
      json?.data?.order?.orderId ||
      json?.data?.merchantOrderId;

    const status =
      json?.status ||
      json?.data?.status ||
      json?.event ||
      json?.type;

    if (orderId) {
      // Пример: если событие означает успешную оплату — ставим PAID
      // (подстроим под реальный payload после 1 webhook)
      const paid =
        String(status || "").toUpperCase().includes("SUCCESS") ||
        String(status || "").toUpperCase().includes("PAID") ||
        String(status || "").toUpperCase().includes("CAPTURE");

      if (paid) {
        await prisma.paymentDraft.updateMany({
          where: { id: String(orderId) },
          data: { status: "PAID" },
        });
      }
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    console.log("❌ YAPAY WEBHOOK ERROR:", e?.message || e);
    // Всегда отвечаем 200, чтобы Яндекс не долбил ретраи бесконечно
    return Response.json({ ok: true });
  }
}