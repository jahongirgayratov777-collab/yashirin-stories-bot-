
import express from "express";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("YASHIRIN STORIES BOT ISHLAYAPTI! ✅");
});

app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;
    const message = update.message;

    if (message) {
      const chatId = message.chat.id;
      const text = message.text || "";

      if (text === "/start") {
        await sendMessage(
          chatId,
          "Assalomu alaykum! 👋\n\n" +
          "🎬 YashirinStoriesBot ga xush kelibsiz!\n\n" +
          "Taklif va murojaatlar: @lorfime\n\n" +
          "Storiesini ko'rmoqchi bo'lgan insoningiz " +
          "Telegram yoki Instagram username'ini kiriting."
        );
      } else if (text.startsWith("@")) {
        const username = text.replace("@", "");

        await sendMessage(
          chatId,
          `👤 Profil: @${username}\n\n` +
          "Kerakli bo'limni tanlang:",
          {
            inline_keyboard: [
              [{ text: "📚 Eski Stories", callback_data: `old:${username}` }],
              [{ text: "🆕 Yangi Stories", callback_data: `new:${username}` }],
              [{ text: "🖼 Profil rasmi", callback_data: `photo:${username}` }]
            ]
          }
        );
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook xatosi:", error);
    res.sendStatus(200);
  }
});

async function sendMessage(chatId, text, keyboard = null) {
  const token = process.env.BOT_TOKEN;

  if (!token) {
    console.error("BOT_TOKEN topilmadi!");
    return;
  }

  const body = {
    chat_id: chatId,
    text
  };

  if (keyboard) body.reply_markup = keyboard;

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  const result = await response.json();
  console.log("Telegram javobi:", result);
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Bot server ${PORT} portda ishga tushdi!`);
});
