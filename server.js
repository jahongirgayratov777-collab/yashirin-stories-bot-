
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
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML"
  };

  if (keyboard) {
    body.reply_markup = { inline_keyboard: keyboard };
  }

  return fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
}

async function sendMedia(chatId, buffer, caption, isVideo = false) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);

  form.append(
    isVideo ? "video" : "photo",
    new Blob([buffer]),
    isVideo ? "story.mp4" : "story.jpg"
  );

  return fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/send${isVideo ? "Video" : "Photo"}`,
    {
      method: "POST",
      body: form
    }
  );
}

async function ensureConnected() {
  if (!tgClient.connected) {
    await tgClient.connect();
  }
}

async function handleMessage(message) {
  if (!message?.chat) return;

  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  if (text === "/start") {
    await sendMessage(
      chatId,
      "👋 <b>Yashirin Stories Bot</b>\n\n" +
      "Telegram username yuboring.\nMasalan: <code>@username</code>"
    );
    return;
  }

  const username = text.replace(/^@/, "");

  if (/^[a-zA-Z0-9_]{5,}$/.test(username)) {
    await sendMessage(
      chatId,
      `👤 <b>@${username}</b>\nPlatformani tanlang:`,
      [[
        { text: "✈️ Telegram", callback_data: `tg:${username}` }
      ]]
    );
    return;
  }

  await sendMessage(chatId, "❌ Username noto‘g‘ri. Qaytadan yuboring.");
}

async function getTelegramUser(username) {
  await ensureConnected();
  return tgClient.getEntity(username);
}

async function handleProfilePhotos(chatId, username) {
  try {
    const user = await getTelegramUser(username);

    const photos = await tgClient.invoke(
      new Api.photos.GetUserPhotos({
        userId: user,
        offset: 0,
        maxId: 0,
        limit: 100
      })
    );

    if (!photos.photos?.length) {
      await sendMessage(chatId, "Profil rasmlari topilmadi.");
      return;
    }

    await sendMessage(
      chatId,
      `🖼 @${username} profil rasmlari: ${photos.photos.length} ta`
    );

    for (const photo of photos.photos) {
      try {
        const buffer = await tgClient.downloadMedia(photo, {});
        if (buffer) {
          await sendMedia(chatId, buffer, `🖼 @${username}`);
        }
      } catch (err) {
        console.error("Photo yuklash xatosi:", err.message);
      }
    }
  } catch (error) {
    console.error("Profil rasmlari:", error);
    await sendMessage(chatId, "❌ Profil rasmlarini olishda xatolik.");
  }
}

async function handleNewStories(chatId, username) {
  try {
    const user = await getTelegramUser(username);

    const result = await tgClient.invoke(
      new Api.stories.GetPeerStories({
        peer: user
      })
    );

    const stories = result.stories?.stories || [];

    if (!stories.length) {
      await sendMessage(
        chatId,
        `📭 @${username} da hozir faol Stories topilmadi.`
      );
      return;
    }

    await sendMessage(
      chatId,
      `🆕 @${username} — ${stories.length} ta Stories topildi.`
    );

    for (const story of stories) {
      try {
        if (story.media?.photo || story.media?.document) {
          const buffer = await tgClient.downloadMedia(story.media, {});

          if (!buffer) continue;

          const isVideo =
            story.media.document?.mimeType?.startsWith("video/") ||
            story.media.document?.attributes?.some(
              attr => attr.className === "DocumentAttributeVideo"
            );

          await sendMedia(
            chatId,
            buffer,
            `📖 @${username} | Story ID: ${story.id}`,
            Boolean(isVideo)
          );
        }
      } catch (err) {
        console.error("Story media xatosi:", err.message);
      }
    }
  } catch (error) {
    console.error("Stories olish xatosi:", error);
    await sendMessage(
      chatId,
      "❌ Stories olish amalga oshmadi.\n" +
      "Profil ochiqligini va akkaunt ruxsatini tekshiring."
    );
  }
}

async function handleCallback(query) {
  if (!query?.message) return;

  const chatId = query.message.chat.id;
  const parts = (query.data || "").split(":");
  const action = parts[0];

  if (action === "tg") {
    const username = parts[1];

    await sendMessage(
      chatId,
      `@${username} uchun xizmatni tanlang:`,
      [
        [{ text: "🆕 Yangi Stories", callback_data: `new:${username}` }],
        [{ text: "🖼 Barcha profil rasmlari", callback_data: `photos:${username}` }],
        [{ text: "📂 Eski Stories", callback_data: `old:${username}` }]
      ]
    );
    return;
  }

  if (action === "photos") {
    await handleProfilePhotos(chatId, parts[1]);
    return;
  }

  if (action === "new") {
    await handleNewStories(chatId, parts[1]);
    return;
  }

  if (action === "old") {
    await sendMessage(
      chatId,
      "📂 Eski Stories arxivi faqat akkaunt egasining mavjud arxivi va Telegram ruxsat bergan ma'lumotlar doirasida olinadi. Bu funksiya keyingi bosqichda ulanadi."
    );
  }
}

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const update = req.body;

    if (update.message) {
      await handleMessage(update.message);
    }

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
    console.error("Webhook xatosi:", error);
  }
});

app.get("/", (req, res) => {
  res.send("Yashirin Stories Bot ishlayapti! 🤖");
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server ${PORT} portda ishga tushdi`);

  if (STRING_SESSION && API_ID && API_HASH) {
    try {
      await tgClient.connect();
      console.log("Telegram MTProto akkaunti ulandi!");
    } catch (error) {
      console.error("MTProto xatosi:", error.message);
    }
  }
});
