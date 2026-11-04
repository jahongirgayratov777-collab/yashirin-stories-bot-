
import express from "express";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_ID = Number(process.env.API_ID);
const API_HASH = process.env.API_HASH;
const STRING_SESSION = process.env.STRING_SESSION;
const PORT = process.env.PORT || 8080;

const tgClient = new TelegramClient(
  new StringSession(STRING_SESSION || ""),
  API_ID,
  API_HASH,
  { connectionRetries: 5 }
);

// Telegram Bot API orqali xabar yuborish
async function sendMessage(chatId, text, keyboard = null) {
  const body = { chat_id: chatId, text };

  if (keyboard) body.reply_markup = keyboard;

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  console.log("Telegram:", await response.text());
}

// Rasm yuborish
async function sendPhoto(chatId, photoBuffer, caption) {
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

  console.log("Rasm yuborish:", await response.text());
}

// Foydalanuvchi xabarlari
async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  if (text === "/start") {
    await sendMessage(
      chatId,
      "Assalomu alaykum! 👋\n\n" +
      "YashirinStoriesBot ga xush kelibsiz!\n\n" +
      "Stories ko'rmoqchi bo'lgan insoningiz username'ini yuboring."
    );
    return;
  }

  if (/^@?[a-zA-Z0-9_]{5,}$/.test(text)) {
    const username = text.replace(/^@/, "");

    await sendMessage(
      chatId,
      `👤 Profil: @${username}\n\nPlatformani tanlang:`,
      {
        inline_keyboard: [
          [{ text: "✈️ Telegram", callback_data: `tg:${username}` }],
          [{ text: "📸 Instagram", callback_data: `ig:${username}` }]
        ]
      }
    );
    return;
  }

  await sendMessage(chatId, "Username yuboring. Masalan: @lorfime");
}

// Tugmalar
async function handleCallback(query) {
  const chatId = query.message.chat.id;
  const data = query.data;

  await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: query.id })
    }
  );

  const parts = data.split(":");
  const action = parts[0];

  // Platforma tanlash
  if (action === "tg" || action === "ig") {
    const username = parts[1];

    await sendMessage(
      chatId,
      `@${username} uchun bo'limni tanlang:`,
      {
        inline_keyboard: [
          [{ text: "🆕 Yangi Stories", callback_data: `new:${action}:${username}` }],
          [{ text: "📚 Eski Stories", callback_data: `old:${action}:${username}` }],
          [{ text: "🖼 Profil rasmi", callback_data: `photo:${action}:${username}` }]
        ]
      }
    );
    return;
  }

  // Telegram profil rasmini olish
  if (action === "photo") {
    const platform = parts[1];
    const username = parts[2];

    if (platform === "tg") {
      try {
        if (!tgClient.connected) {
          await tgClient.connect();
        }

        const user = await tgClient.getEntity(username);
        const photo = await tgClient.downloadProfilePhoto(user, {
          fileType: "jpg"
        });

        if (!photo) {
          await sendMessage(chatId, "❌ Profil rasmi topilmadi.");
          return;
        }

        await sendPhoto(
          chatId,
          photo,
          `🖼 @${username} Telegram profil rasmi`
        );
      } catch (error) {
        console.error("Profil rasmi xatosi:", error);
        await sendMessage(
          chatId,
          "❌ Profil rasmini olishda xatolik.\nUsername to'g'riligini tekshiring."
        );
      }
      return;
    }

    await sendMessage(
      chatId,
      `📸 Instagram @${username}\nInstagram moduli keyingi bosqichda ulanadi.`
    );
    return;
  }

  // Stories
  if (action === "new" || action === "old") {
    const platform = parts[1];
    const username = parts[2];

    await sendMessage(
      chatId,
      `📌 Username: @${username}\n` +
      `📱 Platforma: ${platform === "tg" ? "Telegram" : "Instagram"}\n\n` +
      `${action === "new" ? "🆕 Yangi" : "📚 Eski"} Stories moduli hali ulanmagan.`
    );
  }
}

// Webhook
app.post("/webhook", (req, res) => {
  res.sendStatus(200);

  const update = req.body;

  if (update.message) {
    handleMessage(update.message).catch(console.error);
  }

  if (update.callback_query) {
    handleCallback(update.callback_query).catch(console.error);
  }
});

// Server
app.get("/", (req, res) => {
  res.send("YASHIRIN STORIES BOT ISHLAYAPTI! ✅");
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server ${PORT}-portda ishga tushdi`);

  try {
    await tgClient.connect();
    console.log("Telegram MTProto akkaunti ulandi!");
  } catch (error) {
    console.error("MTProto ulanish xatosi:", error.message);
  }
});
