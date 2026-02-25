import { prisma } from "@/lib/prisma";

function b64urlDecodeToString(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  return Buffer.from(s, "base64").toString("utf8");
}

export async function POST(req: Request) {
  try {
    const jwt = (await req.text()).trim();

    console.log("✅ YAPAY WEBHOOK HIT");
    console.log("headers:", Object.fromEntries(req.headers.entries()));
    console.log("raw body:", jwt);

    const parts = jwt.split(".");
    if (parts.length !== 3) {
      console.log("❌ Bad JWT format");
      return Response.json({ ok: true });
    }

    const payloadStr = b64urlDecodeToString(parts[1]);
    const payload = JSON.parse(payloadStr);

    const event = String(payload?.event || "");
    const orderId = String(payload?.order?.orderId || "");
    const paymentStatus = String(payload?.order?.paymentStatus || "");

    console.log("✅ YAPAY WEBHOOK PAYLOAD:", { event, orderId, paymentStatus });

    if (orderId && paymentStatus === "CAPTURED") {
      await prisma.paymentDraft.updateMany({
        where: { id: orderId },
        data: { status: "PAID" },
      });

      console.log("✅ PaymentDraft marked as PAID:", orderId);
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    console.log("❌ YAPAY WEBHOOK ERROR:", e?.message || e);
    return Response.json({ ok: true });
  }
}