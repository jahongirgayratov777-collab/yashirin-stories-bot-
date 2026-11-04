
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

// FAQAT SIZNING ADMIN ID
const ADMIN_ID = 7663086750;

// Statistika (server qayta ishga tushganda tozalanadi)
const users = new Map();
const logs = [];

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
// ADMIN TEKSHIRISH
// ========================

function isAdmin(chatId) {
  return Number(chatId) === ADMIN_ID;
}

// ========================
// FOYDALANUVCHINI SAQLASH
// ========================

function saveUser(message) {
  const id = message.from?.id;
  if (!id) return;

  users.set(id, {
    id,
    firstName: message.from.first_name || "",
    lastName: message.from.last_name || "",
    username: message.from.username || "username yo‘q",
    lastSeen: new Date().toLocaleString("uz-UZ", {
      timeZone: "Asia/Tashkent"
    })
  });
}

// ========================
// HARAKATLARNI YOZISH
// ========================

function logActivity(user, action, target) {
  logs.unshift({
    userId: user.id,
    userName: user.username || "username yo‘q",
    firstName: user.first_name || "",
    action,
    target,
    time: new Date().toLocaleString("uz-UZ", {
      timeZone: "Asia/Tashkent"
    })
  });

  // Oxirgi 1000 ta harakatni saqlaymiz
  if (logs.length > 1000) logs.length = 1000;
}

// ========================
// ADMIN PANEL
// ========================

async function showAdmin(chatId) {
  if (!isAdmin(chatId)) {
    await sendMessage(chatId, "⛔ Sizda admin huquqi yo‘q.");
    return;
  }

  const today = new Date().toLocaleDateString("uz-UZ", {
    timeZone: "Asia/Tashkent"
  });

  const todayLogs = logs.filter(
    x => x.time.startsWith(today)
  );

  await sendMessage(
    chatId,
    "🔐 <b>YASHIRIN STORIES — ADMIN PANEL</b>\n\n" +
    `👥 Jami foydalanuvchilar: <b>${users.size}</b>\n` +
    `📥 Jami harakatlar: <b>${logs.length}</b>\n` +
    `📅 Bugungi harakatlar: <b>${todayLogs.length}</b>\n\n` +
    "Quyidagi bo‘limni tanlang:",
    [
      [
        { text: "👥 Foydalanuvchilar", callback_data: "admin_users" }
      ],
      [
        { text: "📥 Yuklab olishlar tarixi", callback_data: "admin_logs" }
      ],
      [
        { text: "📊 Statistika", callback_data: "admin_stats" }
      ]
    ]
  );
}

// ========================
// FOYDALANUVCHILAR RO‘YXATI
// ========================

async function showUsers(chatId) {
  if (!isAdmin(chatId)) return;

  const list = [...users.values()];

  if (!list.length) {
    await sendMessage(chatId, "Hozircha foydalanuvchilar yo‘q.");
    return;
  }

  await sendMessage(
    chatId,
    `👥 <b>FOYDALANUVCHILAR (${list.length})</b>`
  );

  for (let i = 0; i < list.length; i += 20) {
    const chunk = list.slice(i, i + 20);

    const text = chunk.map((u, index) =>
      `${i + index + 1}. ${u.firstName} ${u.lastName}\n` +
      `👤 @${u.username}\n` +
      `🆔 <code>${u.id}</code>\n` +
      `🕒 ${u.lastSeen}`
    ).join("\n\n");

    await sendMessage(chatId, text);
  }
}

// ========================
// YUKLAB OLISHLAR TARIXI
// ========================

async function showLogs(chatId) {
  if (!isAdmin(chatId)) return;

  if (!logs.length) {
    await sendMessage(chatId, "📭 Hozircha yuklab olishlar yo‘q.");
    return;
  }

  await sendMessage(chatId, "📥 <b>OXIRGI HARAKATLAR</b>");

  const recent = logs.slice(0, 50);

  for (let i = 0; i < recent.length; i += 10) {
    const chunk = recent.slice(i, i + 10);

    const text = chunk.map((x, index) =>
      `${i + index + 1}. 👤 ${x.firstName}\n` +
      `Username: @${x.userName}\n` +
      `🎯 Amal: ${x.action}\n` +
      `📱 Nishon: @${x.target}\n` +
      `🕒 ${x.time}`
    ).join("\n\n");

    await sendMessage(chatId, text);
  }

  await sendMessage(
    chatId,
    "ℹ️ Oxirgi 50 ta harakat ko‘rsatildi."
  );
}

// ========================
// STATISTIKA
// ========================

async function showStats(chatId) {
  if (!isAdmin(chatId)) return;

  const counts = {
    stories: logs.filter(x => x.action === "Yangi Stories").length,
    highlights: logs.filter(x => x.action === "Highlights").length,
    photos: logs.filter(x => x.action === "Profil rasmlari").length
  };

  await sendMessage(
    chatId,
    "📊 <b>BOT STATISTIKASI</b>\n\n" +
    `👥 Foydalanuvchilar: ${users.size}\n` +
    `📥 Jami so‘rovlar: ${logs.length}\n\n` +
    `🆕 Yangi Stories: ${counts.stories}\n` +
    `📂 Highlights: ${counts.highlights}\n` +
    `🖼 Profil rasmlari: ${counts.photos}`
  );
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

  saveUser(message);

  // ADMIN PANEL
  if (text === "/admin") {
    await showAdmin(chatId);
    return;
  }

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

async function handleProfilePhotos(chatId, username, userInfo) {
  logActivity(userInfo, "Profil rasmlari", username);

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
          await sendMedia(chatId, buffer, `🖼 @${username}`, "photo");
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

    if (doc.mimeType?.startsWith("video/")) return "video";

    if (doc.attributes?.some(
      a => a.className === "DocumentAttributeVideo"
    )) return "video";

    if (doc.mimeType?.startsWith("image/")) return "photo";
  }

  return null;
}

// ========================
// STORIES YUKLAB OLISH
// ========================

async function downloadStories(chatId, username, stories, userInfo, action) {
  if (!stories || stories.length === 0) {
    await sendMessage(chatId, `📭 @${username} uchun Stories topilmadi.`);
    return;
  }

  // Admin statistikasiga qayd etish
  logActivity(userInfo, action, username);

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

      if (!type) continue;

      const buffer = await tgClient.downloadMedia(media);
      if (!buffer) continue;

      const caption =
        `📖 @${username}\n` +
        `Story ID: ${story.id}`;

      const result = await sendMedia(chatId, buffer, caption, type);

      if (result.ok) count++;

    } catch (error) {
      console.error(`STORY ${story.id} ERROR:`, error.message);
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

async function handleNewStories(chatId, username, userInfo) {
  try {
    const peer = await getUser(username);

    const result = await tgClient.invoke(
      new Api.stories.GetPeerStories({ peer })
    );

    const stories = result.stories?.stories || [];

    await downloadStories(
      chatId,
      username,
      stories,
      userInfo,
      "Yangi Stories"
    );

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

async function handleHighlights(chatId, username, userInfo) {
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

    await downloadStories(
      chatId,
      username,
      stories,
      userInfo,
      "Highlights"
    );

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

  // ADMIN TUGMALARI
  if (action.startsWith("admin_")) {
    if (!isAdmin(chatId)) {
      await sendMessage(chatId, "⛔ Admin huquqi yo‘q.");
      return;
    }

    if (action === "admin_users") {
      await showUsers(chatId);
      return;
    }

    if (action === "admin_logs") {
      await showLogs(chatId);
      return;
    }

    if (action === "admin_stats") {
      await showStats(chatId);
      return;
    }
  }

  const userInfo = query.from;

  if (action === "tg") {
    await sendMessage(
      chatId,
      `👤 <b>@${username}</b>\n\nKerakli xizmatni tanlang:`,
      [
        [
          { text: "🆕 Yangi Stories", callback_data: `new:${username}` }
        ],
        [
          { text: "📂 Doimiy Stories (Highlights)", callback_data: `highlights:${username}` }
        ],
        [
          { text: "🖼 Barcha profil rasmlari", callback_data: `photos:${username}` }
        ]
      ]
    );

    return;
  }

  if (action === "new") {
    await handleNewStories(chatId, username, userInfo);
    return;
  }

  if (action === "highlights") {
    await handleHighlights(chatId, username, userInfo);
    return;
  }

  if (action === "photos") {
    await handleProfilePhotos(chatId, username, userInfo);
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
