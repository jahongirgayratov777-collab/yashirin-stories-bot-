
import express from "express";

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 8080;

// Telegramga xabar yuborish
async function sendMessage(chatId, text, keyboard = null) {
  try {
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

    console.log("Telegram javobi:", await response.text());
  } catch (error) {
    console.error("Xabar yuborish xatosi:", error);
  }
}

// Foydalanuvchi xabari
async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  if (text === "/start") {
    await sendMessage(
      chatId,
      "Assalomu alaykum! 👋\n\n" +
      "YashirinStoriesBot ga xush kelibsiz!\n\n" +
      "Taklif va murojaatlar: @lorfime\n\n" +
      "Storiesini ko'rmoqchi bo'lgan insoningiz username'ini kiriting."
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

// Tugmalarni boshqarish
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

  if (action === "photo") {
    const platform = parts[1];
    const username = parts[2];

    await sendMessage(
      chatId,
      `🖼 @${username}\n\n` +
      (platform === "tg"
        ? "Telegram profil rasmini olish funksiyasini tiklaymiz."
        : "Instagram profil rasmini olish funksiyasini tiklaymiz.")
    );
    return;
  }

  if (action === "new" || action === "old") {
    const platform = parts[1];
    const username = parts[2];

    await sendMessage(
      chatId,
      `📌 Username: @${username}\n` +
      `📱 Platforma: ${platform === "tg" ? "Telegram" : "Instagram"}\n\n` +
      `${action === "new" ? "🆕 Yangi" : "📚 Eski"} Stories funksiyasi keyingi bosqichda ulanadi.`
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server ${PORT}-portda ishga tushdi`);
});
