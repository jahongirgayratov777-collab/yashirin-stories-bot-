
import express from "express";
import { TelegramClient } from "telegram";
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

// Telegram orqali xabar yuborish
async function sendMessage(chatId, text, keyboard = null) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML"
  };

  if (keyboard) {
    body.reply_markup = { inline_keyboard: keyboard };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  return response.json();
}

// Rasm yuborish
async function sendPhoto(chatId, photoBuffer, caption = "") {
  const form = new FormData();

  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append(
    "photo",
    new Blob([photoBuffer], { type: "image/jpeg" }),
    "profile.jpg"
  );

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
    {
      method: "POST",
      body: form
    }
  );

  return response.json();
}

// Boshlang‘ich menyu
async function handleMessage(message) {
  if (!message || !message.chat) return;

  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  if (text === "/start") {
    await sendMessage(
      chatId,
      "👋 <b>Yashirin Stories Bot</b>\n\n" +
      "Telegram yoki Instagram username yuboring.\n\n" +
      "Masalan: <code>@username</code>"
    );
    return;
  }

  const username = text.replace(/^@/, "");

  if (/^[a-zA-Z0-9_]{5,}$/.test(username)) {
    const keyboard = [
      [
        {
          text: "✈️ Telegram",
          callback_data: `tg:${username}`
        },
        {
          text: "📸 Instagram",
          callback_data: `ig:${username}`
        }
      ]
    ];

    await sendMessage(
      chatId,
      `👤 Username: <b>@${username}</b>\n\nQaysi platformani tanlaysiz?`,
      keyboard
    );
    return;
  }

  await sendMessage(
    chatId,
    "❌ Username noto‘g‘ri.\n\nIltimos, username yuboring.\nMasalan: <code>@username</code>"
  );
}

// Tugmalarni qayta ishlash
async function handleCallback(query) {
  if (!query || !query.message) return;

  const chatId = query.message.chat.id;
  const data = query.data || "";
  const parts = data.split(":");
  const action = parts[0];

  // Platforma tanlash
  if (action === "tg" || action === "ig") {
    const platform = action;
    const username = parts[1];

    const keyboard = [
      [
        {
          text: "🆕 Yangi Stories",
          callback_data: `new:${platform}:${username}`
        }
      ],
      [
        {
          text: "📂 Eski Stories",
          callback_data: `old:${platform}:${username}`
        }
      ],
      [
        {
          text: "🖼 Profil rasmi",
          callback_data: `photo:${platform}:${username}`
        }
      ]
    ];

    await sendMessage(
      chatId,
      `@${username} uchun kerakli xizmatni tanlang:`,
      keyboard
    );
    return;
  }

  // Profil rasmi
  if (action === "photo") {
    const platform = parts[1];
    const username = parts[2];

    if (platform === "tg") {
      try {
        if (!tgClient.connected) {
          await tgClient.connect();
        }

        const user = await tgClient.getEntity(username);
        const photo = await tgClient.downloadProfilePhoto(user);

        if (!photo) {
          await sendMessage(
            chatId,
            "❌ Bu foydalanuvchida profil rasmi topilmadi."
          );
          return;
        }

        await sendPhoto(
          chatId,
          photo,
          `🖼 Telegram profil rasmi: @${username}`
        );
      } catch (error) {
        console.error("Profil rasmi xatosi:", error);

        await sendMessage(
          chatId,
          "❌ Profil rasmini olishda xatolik.\n" +
          "Username mavjudligini tekshiring."
        );
      }

      return;
    }

    if (platform === "ig") {
      await sendMessage(
        chatId,
        "📸 Instagram profil rasmini olish funksiyasi hozircha sozlanmoqda."
      );
      return;
    }
  }

  // Yangi Stories
  if (action === "new") {
    const platform = parts[1];
    const username = parts[2];

    await sendMessage(
      chatId,
      `🔍 @${username} uchun yangi ${platform === "tg" ? "Telegram" : "Instagram"} Stories qidirilmoqda...\n\n` +
      "Bu funksiya uchun Stories olish moduli alohida ulanishi kerak."
    );
    return;
  }

  // Eski Stories
  if (action === "old") {
    const platform = parts[1];
    const username = parts[2];

    await sendMessage(
      chatId,
      `📂 @${username} uchun eski ${platform === "tg" ? "Telegram" : "Instagram"} Stories.\n\n` +
      "Arxiv Stories funksiyasi hozircha ishlab chiqilmoqda."
    );
  }
}

// Webhook
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

// Server tekshiruvi
app.get("/", (req, res) => {
  res.send("Yashirin Stories Bot ishlayapti! 🤖");
});

// Serverni ishga tushirish
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server ${PORT} portda ishga tushdi`);

  if (STRING_SESSION && API_ID && API_HASH) {
    try {
      await tgClient.connect();
      console.log("Telegram MTProto akkaunti ulandi!");
    } catch (error) {
      console.error("MTProto ulanish xatosi:", error.message);
    }
  } else {
    console.log("MTProto sozlamalari topilmadi. Bot API rejimida ishlaydi.");
  }
});
