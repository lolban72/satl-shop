export function parseAdminChatIds(v?: string) {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdminChatId(chatId: string) {
  const admins = parseAdminChatIds(process.env.TG_ADMIN_CHAT_IDS);
  return admins.includes(String(chatId));
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}