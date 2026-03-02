import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

export const runtime = "nodejs";

const UPLOAD_DIR = "/var/www/satl-uploads";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Можно загружать только изображения" },
        { status: 400 }
      );
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

    // ✅ пишем не в public/, а в постоянную папку вне репо
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const outPath = path.join(UPLOAD_DIR, filename);

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

    // URL остаётся прежним — nginx будет раздавать /uploads/*
    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Ошибка загрузки" },
      { status: 500 }
    );
  }
}