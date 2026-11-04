
import express from "express";

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 8080;

// Botga xabar yuborish
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
      "<b>YashirinStoriesBot</b> ga xush kelibsiz!\n\n" +
      "Taklif va murojaatlar: @lorfime\n\n" +
      "Storiesini ko'rmoqchi bo'lgan insoningiz username'ini kiriting.",
      null
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

  const [action, username] = data.split(":");

  if (action === "photo") {
    const [platform, user] = data.split(":").slice(1);

    if (platform === "tg") {
      await sendMessage(
        chatId,
        `🔍 @${user} Telegram profil rasmini tekshiryapmiz...`
      );

      const response = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${user}&limit=1`
      );

      const result = await response.json();

      if (!result.ok || result.result.total_count === 0) {
        await sendMessage(chatId, "❌ Profil rasmi topilmadi.");
        return;
      }

      await sendMessage(
        chatId,
        "ℹ️ Telegram profil rasmini olish uchun foydalanuvchining Telegram ID raqami kerak. Username orqali ID aniqlashni keyingi bosqichda ulaymiz."
      );
      return;
    }

    await sendMessage(
      chatId,
      "📸 Instagram profil rasmi uchun alohida modul kerak. Keyingi bosqichda ulaymiz."
    );
    return;
  }

  if (action === "tg" || action === "ig") {
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

  const [platform, user] = data.split(":").slice(1);

  const messages = {
    new: "🆕 Yangi Stories olish funksiyasi hozircha ulanmagan.",
    old: "📚 Eski Stories olish funksiyasi hozircha ulanmagan.",
    photo: "🖼 Profil rasmi olish funksiyasi hozircha ulanmagan."
  };

  await sendMessage(
    chatId,
    `${messages[action] || "So'rov bajarildi."}\n\nPlatforma: ${platform === "tg" ? "Telegram" : "Instagram"}\nUsername: @${user}`
  );
}

// Telegram webhook
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

// Server tekshirish
app.get("/", (req, res) => {
  res.send("YASHIRIN STORIES BOT ISHLAYAPTI! ✅");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server ${PORT}-portda ishga tushdi`);
});
