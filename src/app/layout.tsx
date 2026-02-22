import "../styles/globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TopMarquee from "@/components/TopMarquee";
import { Kanit, Brygada_1918 } from "next/font/google";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ✅ один источник Kanit для всего проекта
export const kanitBold = Kanit({
  subsets: ["latin", "latin-ext"],
  weight: ["700"],
  display: "swap",
});

const brygada = Brygada_1918({
  subsets: ["latin", "latin-ext"],
  weight: ["500"],
  display: "swap",
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const marquee = await prisma.marqueeSettings.findFirst();

  const enabled = marquee?.enabled ?? true;
  const text = marquee?.text ?? "СКИДКИ 20%";
  const speedSeconds = marquee?.speedSeconds ?? 100;

  return (
    <html lang="ru" className="h-full">
      <body
        className={`min-h-screen flex flex-col bg-white text-black ${kanitBold.className}`}
      >
        {enabled && (
          <TopMarquee
            text={text}
            speedSeconds={speedSeconds}
            fontClass={brygada.className}
          />
        )}
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
