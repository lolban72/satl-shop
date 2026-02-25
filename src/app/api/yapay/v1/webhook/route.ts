import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function b64urlToBuf(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  return Buffer.from(s, "base64");
}

function verifyEs256(jwt: string, publicKeyPem: string) {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Bad JWT format");

  const [h, p, sig] = parts;

  const data = Buffer.from(`${h}.${p}`, "utf8");
  const signature = b64urlToBuf(sig);

  const ok = crypto.verify("sha256", data, publicKeyPem, signature);
  if (!ok) throw new Error("Bad JWT signature");

  const payloadJson = b64urlToBuf(p).toString("utf8");
  return JSON.parse(payloadJson);
}

function toOrderTotalCents(items: any[]) {
  return items.reduce((s, it) => {
    const price = Number(it?.price ?? 0);
    const qty = Number(it?.qty ?? 0);
    return s + price * qty;
  }, 0);
}

export async function POST(req: Request) {
  try {
    const jwt = (await req.text()).trim();

    // ✅ Публичный ключ Яндекс Пэй (для sandbox это обычно test-key / sandbox key).
    // Добавь в .env многострочным PEM (лучше без кавычек) или одной строкой с \n
    const pub = process.env.YAPAY_WEBHOOK_PUBLIC_KEY_PEM || "";
    if (!pub) {
      console.log("❌ Missing YAPAY_WEBHOOK_PUBLIC_KEY_PEM");
      return Response.json({ ok: true });
    }

    // Иногда ключ кладут в env как "-----BEGIN...\n....\n-----END..."
    const publicKeyPem = pub.includes("\\n") ? pub.replace(/\\n/g, "\n") : pub;

    const payload = verifyEs256(jwt, publicKeyPem);

    // пример payload из твоего лога:
    // {
    //   event: "ORDER_STATUS_UPDATED",
    //   order: { orderId: "...", paymentStatus: "CAPTURED" },
    //   merchantId: "...",
    //   ...
    // }

    const event = String(payload?.event || "");
    const orderId = String(payload?.order?.orderId || "");
    const paymentStatus = String(payload?.order?.paymentStatus || "");

    console.log("✅ YAPAY WEBHOOK VERIFIED", { event, orderId, paymentStatus });

    if (!orderId) return Response.json({ ok: true });

    // считаем оплату успешной, когда CAPTURED
    const isPaid = paymentStatus === "CAPTURED";

    if (isPaid) {
      // ✅ ставим PAID
      await prisma.paymentDraft.updateMany({
        where: { id: orderId },
        data: { status: "PAID" },
      });

      // ✅ создаём Order ровно 1 раз (если ещё не создан)
      // Для этого нужно хранить draftId в заказе.
      // Самый простой способ — сделать orderId = draftId (но у тебя id генерируется cuid()).
      // Поэтому делаем "защиту" через paymentDraft.status и отдельную таблицу/поле.
      // Если у тебя нет поля, сделаем безопасно через поиск заказа по draftId в itemsJson/metadata невозможно.
      // Поэтому сейчас просто НЕ создаём Order здесь автоматически,
      // а оставляем как "PAID" и дальше отдельный эндпоинт создаст Order.
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    console.log("❌ YAPAY WEBHOOK ERROR:", e?.message || e);
    return Response.json({ ok: true });
  }
}