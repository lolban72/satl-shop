const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";

if (!TG_BOT_TOKEN) {
  console.warn("⚠️ TG_BOT_TOKEN не задан в .env");
}

export function parseChatIds(v?: string) {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function tgSendMessage(chatId: string, text: string) {
  if (!TG_BOT_TOKEN) return;

  const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("TG sendMessage error:", err);
    throw new Error(err);
  }

  return await res.json();
}

// ✅ НОВОЕ: отправка фото по file_id (который телега присылает в webhook)
export async function tgSendPhoto(chatId: string, fileId: string, caption?: string) {
  if (!TG_BOT_TOKEN) return;

  const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: fileId,
      caption: caption?.trim() ? caption.trim() : undefined,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("TG sendPhoto error:", err);
    throw new Error(err);
  }

  return await res.json();
}