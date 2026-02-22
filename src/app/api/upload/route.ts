import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import sharp from "sharp";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Можно загружать только изображения" }, { status: 400 });
    }

    // GIF/SVG лучше не пережимать sharp-ом таким способом
    if (file.type === "image/gif" || file.type === "image/svg+xml") {
      return NextResponse.json(
        { error: "GIF/SVG пока не поддерживаются для конвертации" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const input = Buffer.from(bytes);

    const filename = `${randomUUID()}.webp`;

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    const outPath = path.join(uploadDir, filename);

    // ✅ конвертация в WebP + уменьшение до разумного размера
    const webpBuffer = await sharp(input)
      .rotate() // учитывает EXIF-ориентацию
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 }) // 75–85 обычно sweet spot
      .toBuffer();

    await fs.writeFile(outPath, webpBuffer);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Ошибка загрузки" }, { status: 500 });
  }
}
