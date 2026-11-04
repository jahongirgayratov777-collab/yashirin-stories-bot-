
import express from "express";

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 8080;

async function sendMessage(chatId, text, keyboard = null) {
  const body = { chat_id: chatId, text };
  if (keyboard) body.reply_markup = keyboard;

  const r = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  console.log("sendMessage:", await r.text());
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  if (text === "/start") {
    return sendMessage(
      chatId,
      "Assalomu alaykum! 👋\n\n" +
      "🎬 YashirinStoriesBot ga xush kelibsiz!\n\n" +
      "Stories ko'rmoqchi bo'lgan username'ni yuboring.\n" +
      "Masalan: @lorfime"
    );
  }

  if (/^@?[a-zA-Z0-9_]{5,}$/.test(text)) {
    const username = text.replace(/^@/, "");

    return sendMessage(chatId, `👤 @${username}\n\nPlatformani tanlang:`, {
      inline_keyboard: [
        [{ text: "✈️ Telegram", callback_data: `tg:${username}` }],
        [{ text: "📸 Instagram", callback_data: `ig:${username}` }]
      ]
    });
  }

  return sendMessage(chatId, "Username yuboring. Masalan: @lorfime");
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

    return sendMessage(chatId, `@${username} uchun bo'limni tanlang:`, {
      inline_keyboard: [
        [{ text: "🆕 Yangi Stories", callback_data: `new:${platform}:${username}` }],
        [{ text: "📚 Eski Stories", callback_data: `old:${platform}:${username}` }],
        [{ text: "🖼 Profil rasmi", callback_data: `photo:${platform}:${username}` }]
      ]
    });
  }

  const [action, platform, username] = parts;

  const messages = {
    new: "🆕 Yangi Stories funksiyasi hozircha ulanmagan.",
    old: "📚 Eski Stories funksiyasi hozircha ulanmagan.",
    photo: "🖼 Profil rasmi funksiyasi hozircha ulanmagan."
  };

  return sendMessage(
    chatId,
    `${messages[action] || "So'rov bajarildi"}\nPlatforma: ${platform}\nUsername: @${username}`
  );
}

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    if (req.body.message) await handleMessage(req.body.message);
    if (req.body.callback_query) await handleCallback(req.body.callback_query);
  } catch (e) {
    console.error("WEBHOOK ERROR:", e);
  }
});

app.get("/", (req, res) => {
  res.send("YASHIRIN STORIES BOT ISHLAYAPTI! ✅");
});

app.listen(PORT, async () => {
  console.log(`Server ${PORT} da ishlayapti`);

  const url =
    "https://yashirin-stories-bot-production-b4a1.up.railway.app/webhook";

  const r = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${url}`
  );

  console.log("Webhook:", await r.text());
});
