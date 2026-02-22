import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { tgSendMessage } from "@/lib/tg";

const TG_WEBHOOK_SECRET = process.env.TG_WEBHOOK_SECRET || "";

// Админы (chatId через запятую)
const TG_ADMIN_CHAT_IDS = process.env.TG_ADMIN_CHAT_IDS || "";

function parseAdminChatIds(v?: string) {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAdminChatId(chatId: string) {
  const admins = parseAdminChatIds(TG_ADMIN_CHAT_IDS);
  return admins.includes(String(chatId));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function normalizeCode(text: string) {
  return text.trim().toUpperCase().replace(/\s+/g, "");
}

export async function POST(req: Request) {
  try {
    // ✅ Проверка секрета вебхука от Telegram
    if (TG_WEBHOOK_SECRET) {
      const header = req.headers.get("x-telegram-bot-api-secret-token") || "";
      if (header !== TG_WEBHOOK_SECRET) {
        // всегда 200, чтобы Telegram не ретраил
        return Response.json({ ok: true });
      }
    }

    const update: any = await req.json().catch(() => null);
    if (!update) return Response.json({ ok: true });

    const msg = update?.message || update?.edited_message;
    const chatIdNum = msg?.chat?.id;
    const chatId = chatIdNum ? String(chatIdNum) : null;
    const textRaw = msg?.text ? String(msg.text) : "";

    if (!chatId) return Response.json({ ok: true });

    const username = msg?.from?.username ? String(msg.from.username) : null;
    const text = (textRaw || "").trim();

    // =========================
    // ✅ ADMIN: рассылка из бота
    // =========================
    if (isAdminChatId(chatId)) {
      const t = text;

      // /myid — чтобы узнать свой chatId
      if (t === "/myid") {
        await tgSendMessage(chatId, `Ваш chatId: <b>${chatId}</b>`);
        return Response.json({ ok: true });
      }

      // /broadcast — начать рассылку
      if (t === "/broadcast") {
        await prisma.tgAdminState.upsert({
          where: { chatId },
          update: { mode: "BROADCAST_DRAFT", draftText: null },
          create: { chatId, mode: "BROADCAST_DRAFT", draftText: null },
        });

        await tgSendMessage(
          chatId,
          "🟢 Режим рассылки включён.\n\nОтправьте <b>следующим сообщением</b> текст рассылки.\n\nОтмена: /cancel"
        );
        return Response.json({ ok: true });
      }

      // /cancel — отмена
      if (t === "/cancel") {
        await prisma.tgAdminState.upsert({
          where: { chatId },
          update: { mode: "IDLE", draftText: null },
          create: { chatId, mode: "IDLE", draftText: null },
        });

        await tgSendMessage(chatId, "❌ Отменено.");
        return Response.json({ ok: true });
      }

      // /send — отправить рассылку
      if (t === "/send") {
        const state = await prisma.tgAdminState.findUnique({ where: { chatId } });

        if (!state || state.mode !== "BROADCAST_DRAFT" || !state.draftText?.trim()) {
          await tgSendMessage(
            chatId,
            "Нет текста для рассылки.\n\nСначала: /broadcast → затем текст → затем /send"
          );
          return Response.json({ ok: true });
        }

        const msgText = state.draftText.trim();

        // Берём подписчиков: newsletterEnabled=true + tgChatId
        const users = await prisma.user.findMany({
          where: { newsletterEnabled: true, tgChatId: { not: null } },
          select: { tgChatId: true },
          take: 10000,
        });

        const recipients = users
          .map((u) => u.tgChatId)
          .filter(Boolean) as string[];

        if (recipients.length === 0) {
          await tgSendMessage(chatId, "Подписчиков нет (newsletterEnabled=true + tgChatId).");
          return Response.json({ ok: true });
        }

        await tgSendMessage(
          chatId,
          `🚀 Начинаю рассылку...\nПолучателей: <b>${recipients.length}</b>`
        );

        let okCount = 0;
        let failCount = 0;

        // осторожно по лимитам телеги
        for (const to of recipients) {
          try {
            await tgSendMessage(to, msgText);
            okCount++;
          } catch {
            failCount++;
          }
          await sleep(60);
        }

        // сброс состояния
        await prisma.tgAdminState.update({
          where: { chatId },
          data: { mode: "IDLE", draftText: null },
        });

        await tgSendMessage(
          chatId,
          `✅ Готово!\nУспешно: <b>${okCount}</b>\nОшибки: <b>${failCount}</b>`
        );

        return Response.json({ ok: true });
      }

      // Если админ в режиме draft — любое сообщение считаем текстом
      const state = await prisma.tgAdminState.findUnique({ where: { chatId } });
      if (state?.mode === "BROADCAST_DRAFT") {
        const draft = t;

        if (draft.length < 2) {
          await tgSendMessage(chatId, "Текст слишком короткий. Отправьте нормальный текст или /cancel.");
          return Response.json({ ok: true });
        }

        await prisma.tgAdminState.update({
          where: { chatId },
          data: { draftText: draft },
        });

        await tgSendMessage(
          chatId,
          `📝 Предпросмотр:\n\n${draft}\n\nЕсли всё ок — отправьте /send\nЕсли передумали — /cancel`
        );

        return Response.json({ ok: true });
      }
    }

    // =========================
    // ✅ USER: привязка аккаунта
    // =========================

    // /start — просто объясняем что делать
    if (text.toLowerCase().startsWith("/start")) {
      await tgSendMessage(
        chatId,
        "Привет! 👋\n\nЧтобы привязать аккаунт:\n1) Зайди на сайт → Подтверждение Telegram\n2) Сгенерируй код\n3) Отправь этот код мне одним сообщением"
      );
      return Response.json({ ok: true });
    }

    const code = normalizeCode(text);

    // если сообщение не похоже на код — подсказываем
    if (!/^[A-Z0-9]{6,10}$/.test(code)) {
      await tgSendMessage(chatId, "Отправь мне код, который выдал сайт (обычно 6 символов).");
      return Response.json({ ok: true });
    }

    const codeHash = sha256(code);

    // ищем активный код
    const row = await prisma.tgLinkCode.findFirst({
      where: {
        codeHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true },
    });

    if (!row) {
      await tgSendMessage(chatId, "Код неверный или истёк. Сгенерируй новый код на сайте.");
      return Response.json({ ok: true });
    }

    await prisma.$transaction(async (tx) => {
      // помечаем код использованным
      await tx.tgLinkCode.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });

      // привязываем tg к пользователю + подтверждаем аккаунт
      await tx.user.update({
        where: { id: row.userId },
        data: {
          tgChatId: chatId,
          tgUsername: username,
          tgLinkedAt: new Date(),
          tgVerifiedAt: new Date(),
          isVerified: true,
        },
      });

      // чистим остальные неиспользованные коды этого пользователя
      await tx.tgLinkCode.deleteMany({
        where: { userId: row.userId, usedAt: null },
      });
    });

    await tgSendMessage(chatId, "Аккаунт привязан ✅");
    return Response.json({ ok: true });
  } catch {
    // всегда 200, чтобы Telegram не ретраил бесконечно
    return Response.json({ ok: true });
  }
}