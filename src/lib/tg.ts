const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";

if (!TG_BOT_TOKEN) {
  console.warn("⚠️ TG_BOT_TOKEN не задан в .env");
}

export async function tgSendMessage(
  chatId: string,
  text: string
) {
  if (!TG_BOT_TOKEN) return;

  const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;

  try {
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
      throw new Error(err);
    }

    return await res.json();
  } catch (err) {
    console.error("TG sendMessage error:", err);
    throw err;
  }
}