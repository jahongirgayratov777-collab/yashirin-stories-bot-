
import express from "express";

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 8080;

async function sendMessage(chatId, text, keyboard = null) {
  const body = { chat_id: chatId, text, parse_mode: "HTML" };
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

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  if (text === "/start") {
    await sendMessage(
      chatId,
      "Assalomu alaykum! 👋\n\n" +
      "<b>YashirinStoriesBot</b> ga xush kelibsiz!\n\n" +
      "Taklif va murojaatlar: @lorfime\n\n" +
      "Storiesini ko'rmoqchi bo'lgan insoningiz username'ini kiriting."
    );
    return;
  }

  if (/^@?[a-zA-Z0-9_]{5,}$/.test(text)) {
    const username = text.replace(/^@/, "");

    await sendMessage(chatId, `👤 Profil: <b>@${username}</b>\n\nPlatformani tanlang:`, {
      inline_keyboard: [
        [{ text: "✈️ Telegram", callback_data: `tg:${username}` }],
        [{ text: "📸 Instagram", callback_data: `ig:${username}` }]
      ]
    });
    return;
  }

  await sendMessage(chatId, "Iltimos, username yuboring. Masalan: @username");
}

async function handleCallback(query) {
  const chatId = query.message.chat.id;
  const data = query.data;

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: query.id })
  });

  const parts = data.split(":");

  if (parts[0] === "tg" || parts[0] === "ig") {
    const platform = parts[0];
    const username = parts[1];

    await sendMessage(chatId, `@${username} uchun bo'limni tanlang:`, {
      inline_keyboard: [
        [{ text: "🆕 Yangi Stories", callback_data: `new:${platform}:${username}` }],
        [{ text: "📚 Eski Stories", callback_data: `old:${platform}:${username}` }],
        [{ text: "🖼 Profil rasmi", callback_data: `photo:${platform}:${username}` }]
      ]
    });
    return;
  }

  const [action, platform, username] = parts;

  const messages = {
    new: "🆕 Yangi Stories olish funksiyasi hozircha ulanmagan.",
    old: "📚 Eski Stories olish funksiyasi hozircha ulanmagan.",
    photo: "🖼 Profil rasmi olish funksiyasi hozircha ulanmagan."
  };

  await sendMessage(
    chatId,
    `${messages[action] || "So'rov bajarildi"}\n\n` +
    `Platforma: ${platform === "tg" ? "Telegram" : "Instagram"}\n` +
    `Username: @${username}`
  );
}

app.post("/webhook", (req, res) => {
  res.sendStatus(200);

  const update = req.body;

  if (update.message) handleMessage(update.message).catch(console.error);
  if (update.callback_query) handleCallback(update.callback_query).catch(console.error);
});

app.get("/", (req, res) => {
  res.send("YASHIRIN STORIES BOT ISHLAYAPTI! ✅");
});

app.listen(PORT, () => console.log(`Server ${PORT} da ishlayapti`));
