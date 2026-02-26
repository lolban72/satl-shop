// src/app/api/marquee/route.ts
import { prisma } from "@/lib/prisma";

export async function GET() {
  const marquee = await prisma.marqueeSettings.findFirst();
  return new Response(JSON.stringify(marquee), {
    headers: { "Content-Type": "application/json" },
  });
}