
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

// ========================
// XABAR YUBORISH
// ========================

async function sendMessage(chatId, text, keyboard = null) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML"
  };

  if (keyboard) {
    body.reply_markup = { inline_keyboard: keyboard };
  }

  const r = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  return r.json();
}

// ========================
// FOTO / VIDEO YUBORISH
// ========================

async function sendMedia(chatId, buffer, caption, type) {
  const isVideo = type === "video";
  const method = isVideo ? "sendVideo" : "sendPhoto";
  const field = isVideo ? "video" : "photo";

  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append(
    field,
    new Blob([buffer], {
      type: isVideo ? "video/mp4" : "image/jpeg"
    }),
    isVideo ? "story.mp4" : "story.jpg"
  );

  const r = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    { method: "POST", body: form }
  );

  const result = await r.json();

  if (!result.ok) {
    console.error("MEDIA SEND ERROR:", result.description);
  }

  return result;
}

// ========================
// TELEGRAM AKKAUNT
// ========================

async function connectAccount() {
  if (!tgClient.connected) {
    await tgClient.connect();
  }
}

async function getUser(username) {
  await connectAccount();
  return tgClient.getEntity(username);
}

// ========================
// START MENYUSI
// ========================

async function handleMessage(message) {
  if (!message?.chat) return;

  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  if (text === "/start") {
    await sendMessage(
      chatId,
      "👋 <b>Assalomu alaykum!</b>\n\n" +
      "🕵️ <b>YASHIRIN STORIES BOT</b> ga xush kelibsiz!\n\n" +
      "📱 Bot imkoniyatlari:\n" +
      "🆕 Yangi Telegram Stories\n" +
      "📂 Doimiy Stories (Highlights)\n" +
      "🖼 Profil rasmlari\n" +
      "🎥 Foto va video yuklab olish\n\n" +
      "💬 Talab va takliflar: @lorfime\n\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      "✍️ <b>Username kiriting:</b>\n" +
      "Masalan: <code>@username</code>"
    );

    return;
  }

  const username = text.replace(/^@/, "");

  if (/^[a-zA-Z0-9_]{5,}$/.test(username)) {
    await sendMessage(
      chatId,
      `👤 Username: <b>@${username}</b>\n\nPlatformani tanlang:`,
      [[
        {
          text: "✈️ Telegram",
          callback_data: `tg:${username}`
        }
      ]]
    );

    return;
  }

  await sendMessage(
    chatId,
    "❌ Username noto‘g‘ri.\n\n" +
    "✍️ Username kiriting:\n" +
    "Masalan: <code>@username</code>"
  );
}

// ========================
// PROFIL RASMLARI
// ========================

async function handleProfilePhotos(chatId, username) {
  try {
    const user = await getUser(username);

    const result = await tgClient.invoke(
      new Api.photos.GetUserPhotos({
        userId: user,
        offset: 0,
        maxId: 0,
        limit: 100
      })
    );

    if (!result.photos || result.photos.length === 0) {
      await sendMessage(chatId, "📭 Profil rasmlari topilmadi.");
      return;
    }

    await sendMessage(
      chatId,
      `🖼 <b>@${username}</b>\n${result.photos.length} ta profil rasmi topildi.`
    );

    for (const photo of result.photos) {
      try {
        const buffer = await tgClient.downloadMedia(photo);

        if (buffer) {
          await sendMedia(
            chatId,
            buffer,
            `🖼 @${username}`,
            "photo"
          );
        }
      } catch (e) {
        console.error("PHOTO ERROR:", e.message);
      }
    }
  } catch (error) {
    console.error("PROFILE ERROR:", error);
    await sendMessage(
      chatId,
      `❌ Profil rasmi xatosi:\n<code>${error.message}</code>`
    );
  }
}

// ========================
// STORIES MEDIA TURINI ANIQLASH
// ========================

function detectMediaType(media) {
  if (media?.photo) return "photo";

  if (media?.document) {
    const doc = media.document;

    if (doc.mimeType?.startsWith("video/")) {
      return "video";
    }

    if (doc.attributes?.some(
      a => a.className === "DocumentAttributeVideo"
    )) {
      return "video";
    }

    if (doc.mimeType?.startsWith("image/")) {
      return "photo";
    }
  }

  return null;
}

// ========================
// STORIES YUKLAB OLISH
// ========================

async function downloadStories(chatId, username, stories) {
  if (!stories || stories.length === 0) {
    await sendMessage(
      chatId,
      `📭 @${username} uchun Stories topilmadi.`
    );
    return;
  }

  await sendMessage(
    chatId,
    `✅ <b>@${username}</b>\n` +
    `📚 ${stories.length} ta Stories topildi.\n\n` +
    "⏳ Yuklab yuborilmoqda..."
  );

  let count = 0;

  for (const story of stories) {
    try {
      const media = story.media;
      const type = detectMediaType(media);

      if (!type) {
        console.log("Noma'lum media turi:", story.id);
        continue;
      }

      const buffer = await tgClient.downloadMedia(media);

      if (!buffer) continue;

      const caption =
        `📖 @${username}\n` +
        `Story ID: ${story.id}`;

      const result = await sendMedia(
        chatId,
        buffer,
        caption,
        type
      );

      if (result.ok) count++;

    } catch (error) {
      console.error(
        `STORY ${story.id} ERROR:`,
        error.message
      );
    }
  }

  await sendMessage(
    chatId,
    `✅ Tayyor!\n📥 ${count} ta media yuborildi.`
  );
}

// ========================
// YANGI STORIES
// ========================

async function handleNewStories(chatId, username) {
  try {
    const peer = await getUser(username);

    const result = await tgClient.invoke(
      new Api.stories.GetPeerStories({
        peer
      })
    );

    const stories = result.stories?.stories || [];

    await downloadStories(chatId, username, stories);

  } catch (error) {
    console.error("NEW STORIES ERROR:", error);

    await sendMessage(
      chatId,
      "❌ Yangi Stories olishda xatolik:\n\n" +
      `<code>${error.message}</code>`
    );
  }
}

// ========================
// DOIMIY STORIES / HIGHLIGHTS
// ========================

async function handleHighlights(chatId, username) {
  try {
    const peer = await getUser(username);

    const result = await tgClient.invoke(
      new Api.stories.GetPinnedStories({
        peer,
        offsetId: 0,
        limit: 100
      })
    );

    const stories = result.stories || [];

    await downloadStories(chatId, username, stories);

  } catch (error) {
    console.error("HIGHLIGHTS ERROR:", error);

    await sendMessage(
      chatId,
      "❌ Doimiy Stories olishda xatolik:\n\n" +
      `<code>${error.message}</code>`
    );
  }
}

// ========================
// TUGMALAR
// ========================

async function handleCallback(query) {
  if (!query?.message) return;

  const chatId = query.message.chat.id;
  const parts = (query.data || "").split(":");

  const action = parts[0];
  const username = parts[1];

  if (action === "tg") {
    await sendMessage(
      chatId,
      `👤 <b>@${username}</b>\n\nKerakli xizmatni tanlang:`,
      [
        [
          {
            text: "🆕 Yangi Stories",
            callback_data: `new:${username}`
          }
        ],
        [
          {
            text: "📂 Doimiy Stories (Highlights)",
            callback_data: `highlights:${username}`
          }
        ],
        [
          {
            text: "🖼 Barcha profil rasmlari",
            callback_data: `photos:${username}`
          }
        ]
      ]
    );

    return;
  }

  if (action === "new") {
    await handleNewStories(chatId, username);
    return;
  }

  if (action === "highlights") {
    await handleHighlights(chatId, username);
    return;
  }

  if (action === "photos") {
    await handleProfilePhotos(chatId, username);
    return;
  }
}

// ========================
// WEBHOOK
// ========================

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
          headers: {
            "Content-Type": "application/json"
          },
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

// ========================
// SERVER
// ========================

app.get("/", (req, res) => {
  res.send("YASHIRIN STORIES BOT IS RUNNING!");
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Server started on port ${PORT}`);

  try {
    await connectAccount();
    console.log("✅ Telegram MTProto account connected!");
  } catch (error) {
    console.error("❌ MTProto connection error:", error.message);
  }
});
