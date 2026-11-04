
import express from "express";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_ID = Number(process.env.API_ID);
const API_HASH = process.env.API_HASH;

const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("YASHIRIN STORIES BOT ISHLAYAPTI! ✅");
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const update = req.body;

    if (update.message) {
      await handleMessage(update.message);
    }

    if (update.callback_query) {
      await handleCallback(update.callback_query);
    }
  } catch (error) {
    console.error("Webhook xatosi:", error);
  }
});

async function sendMessage(chatId, text, keyboard = null) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML"
  };

  if (keyboard) body.reply_markup = keyboard;

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  console.log("Telegram javobi:", await response.text());
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  if (text === "/start") {
    await sendMessage(
      chatId,
      "Assalomu alaykum! 👋\n\n" +
      "<b>YashirinStoriesBot</b> ga xush kelibsiz!\n\n" +
      "Taklif va murojaatlar: @lorfime\n\n" +
      "Storiesini ko'rmoqchi bo'lgan insoningizning username'ini kiriting."
    );
    return;
  }

  if (text.startsWith("@") || /^[a-zA-Z0-9_]{5,}$/.test(text)) {
    const username = text.replace("@", "");

    await sendMessage(
      chatId,
      `👤 Profil: <b>@${username}</b>\n\nPlatformani tanlang:`,
      {
        inline_keyboard: [
          [{ text: "✈️ Telegram", callback_data: `tg:${username}` }],
          [{ text: "📸 Instagram", callback_data: `ig:${username}` }]
        ]
      }
    );
    return;
  }

  await sendMessage(chatId, "Iltimos, username yuboring. Masalan: @username");
}

async function handleCallback(query) {
  const chatId = query.message.chat.id;
  const [platform, username] = query.data.split(":");

  await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: query.id })
    }
  );

  const keyboard = {
    inline_keyboard: [
      [{ text: "🆕 Yangi Stories", callback_data: `new:${platform}:${username}` }],
      [{ text: "📚 Eski Stories", callback_data: `old:${platform}:${username}` }],
      [{ text: "🖼 Profil rasmi", callback_data: `photo:${platform}:${username}` }]
    ]
  };

  if (platform === "tg" || platform === "ig") {
    await sendMessage(
      chatId,
      `@${username} uchun bo'limni tanlang:`,
      keyboard
    );
    return;
  }

  const [action, source, user] = query.data.split(":");

  const messages = {
    new: "🆕 Yangi Stories olish funksiyasi ulanmoqda.",
    old: "📚 Eski Stories olish funksiyasi ulanmoqda.",
    photo: "🖼 Profil rasmini olish funksiyasi ulanmoqda."
  };

  await sendMessage(
    chatId,
    `${messages[action] || "So'rov bajarilmoqda..."}\n\n` +
    `Platforma: ${source === "tg" ? "Telegram" : "Instagram"}\n` +
    `Username: @${user}\n\n` +
    "Keyingi bosqichda media olish modulini ulaymiz."
  );
}

app.listen(PORT, () => {
  console.log(`Bot server ${PORT}-portda ishga tushdi.`);
});
