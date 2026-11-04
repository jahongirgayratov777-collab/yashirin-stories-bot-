
import express from "express";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_ID = Number(process.env.API_ID);
const API_HASH = process.env.API_HASH;
const STRING_SESSION = process.env.STRING_SESSION || "";
const PORT = process.env.PORT || 8080;

const tgClient = new TelegramClient(
  new StringSession(STRING_SESSION),
  API_ID,
  API_HASH,
  { connectionRetries: 5 }
);

async function sendMessage(chatId, text, keyboard = null) {
  const body = { chat_id: chatId, text, parse_mode: "HTML" };
  if (keyboard) body.reply_markup = { inline_keyboard: keyboard };

  return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function sendMedia(chatId, buffer, caption, video = false) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append(
    video ? "video" : "photo",
    new Blob([buffer]),
    video ? "story.mp4" : "story.jpg"
  );

  return fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/send${video ? "Video" : "Photo"}`,
    { method: "POST", body: form }
  );
}

async function connectUser() {
  if (!tgClient.connected) await tgClient.connect();
}

async function handleMessage(message) {
  if (!message?.chat) return;
  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  if (text === "/start") {
    return sendMessage(
      chatId,
      "👋 <b>Yashirin Stories Bot</b>\n\nTelegram username yuboring:\nMasalan: <code>@username</code>"
    );
  }

  const username = text.replace(/^@/, "");

  if (/^[a-zA-Z0-9_]{5,}$/.test(username)) {
    return sendMessage(chatId, `👤 @${username}\n\nXizmatni tanlang:`, [
      [{ text: "✈️ Telegram", callback_data: `tg:${username}` }]
    ]);
  }

  return sendMessage(chatId, "❌ Username noto‘g‘ri.");
}

async function handleProfilePhotos(chatId, username) {
  try {
    await connectUser();
    const user = await tgClient.getEntity(username);

    const result = await tgClient.invoke(
      new Api.photos.GetUserPhotos({
        userId: user,
        offset: 0,
        maxId: 0,
        limit: 100
      })
    );

    if (!result.photos?.length) {
      return sendMessage(chatId, "Profil rasmlari topilmadi.");
    }

    await sendMessage(chatId, `🖼 @${username}: ${result.photos.length} ta rasm`);

    for (const photo of result.photos) {
      const buffer = await tgClient.downloadMedia(photo);
      if (buffer) await sendMedia(chatId, buffer, `🖼 @${username}`);
    }
  } catch (error) {
    console.error("PROFILE ERROR:", error);
    await sendMessage(chatId, `❌ Profil rasmi xatosi: ${error.message}`);
  }
}

async function handleStories(chatId, username) {
  try {
    await connectUser();
    const peer = await tgClient.getEntity(username);

    const result = await tgClient.invoke(
      new Api.stories.GetPeerStories({ peer })
    );

    const stories = result.stories?.stories || [];

    if (!stories.length) {
      return sendMessage(
        chatId,
        `📭 @${username} hozir faol Stories joylamagan yoki Stories sizga ko‘rinmaydi.`
      );
    }

    await sendMessage(chatId, `🆕 ${stories.length} ta Stories topildi.`);

    for (const story of stories) {
      try {
        const media = story.media;
        const buffer = await tgClient.downloadMedia(media);

        if (!buffer) continue;

        const video =
          media.document?.mimeType?.startsWith("video/") ||
          media.document?.attributes?.some(a => a.className === "DocumentAttributeVideo");

        await sendMedia(
          chatId,
          buffer,
          `📖 @${username} | Story ${story.id}`,
          Boolean(video)
        );
      } catch (e) {
        console.error("STORY MEDIA ERROR:", e);
      }
    }
  } catch (error) {
    console.error("STORIES ERROR:", error);
    await sendMessage(chatId, `❌ Stories xatosi: ${error.message}`);
  }
}

async function handleCallback(query) {
  if (!query?.message) return;

  const chatId = query.message.chat.id;
  const parts = (query.data || "").split(":");
  const action = parts[0];
  const username = parts[1];

  if (action === "tg") {
    return sendMessage(chatId, `@${username} — tanlang:`, [
      [{ text: "🆕 Yangi Stories", callback_data: `new:${username}` }],
      [{ text: "📂 Eski Stories", callback_data: `old:${username}` }],
      [{ text: "🖼 Barcha profil rasmlari", callback_data: `photos:${username}` }]
    ]);
  }

  if (action === "new") return handleStories(chatId, username);
  if (action === "photos") return handleProfilePhotos(chatId, username);

  if (action === "old") {
    return sendMessage(
      chatId,
      "📂 Eski Stories: Telegram boshqa foydalanuvchilarning muddati o‘tgan Stories arxivini umumiy tarzda bermaydi. Faqat akkaunt egasining o‘z arxivi yoki mavjud ochiq Stories olinishi mumkin."
    );
  }
}

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const update = req.body;

    if (update.message) await handleMessage(update.message);

    if (update.callback_query) {
      await handleCallback(update.callback_query);

      await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: update.callback_query.id
          })
        }
      );
    }
  } catch (error) {
    console.error("WEBHOOK ERROR:", error);
  }
});

app.get("/", (req, res) => res.send("Yashirin Stories Bot ishlayapti!"));

app.listen(PORT, "0.0.0.0", async () => {
  console.log("Server ishga tushdi:", PORT);

  try {
    await connectUser();
    console.log("Telegram akkaunt ulandi!");
  } catch (error) {
    console.error("Telegram ulanish xatosi:", error.message);
  }
});
