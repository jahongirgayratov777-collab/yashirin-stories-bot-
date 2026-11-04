
export default {
  async fetch(request, env) {
    if (request.method === "GET") {
      return new Response("YASHIRIN STORIES BOT ISHLAYAPTI! ✅");
    }

    if (request.method === "POST") {
      try {
        const update = await request.json();

        if (update.message) {
          const chatId = update.message.chat.id;
          const text = (update.message.text || "").trim();

          if (text === "/start") {
            await sendTelegram(env, "sendMessage", {
              chat_id: chatId,
              text:
                "Assalomu alaykum! 👋\n\n" +
                "YashirinStoriesBot ga xush kelibsiz!\n\n" +
                "Taklif va murojaatlar: @lorfime\n\n" +
                "Storiesini ko'rmoqchi bo'lgan insoningizning " +
                "Telegram yoki Instagram username'ini kiriting."
            });
          } else if (text.startsWith("@") || /^[a-zA-Z0-9_.]{3,}$/.test(text)) {
            const username = text.replace("@", "");

            await sendTelegram(env, "sendMessage", {
              chat_id: chatId,
              text: `👤 @${username}\n\nKerakli bo'limni tanlang:`,
              reply_markup: {
                inline_keyboard: [
                  [{ text: "📚 Eski Stories", callback_data: `old:${username}` }],
                  [{ text: "🆕 Yangi Stories", callback_data: `new:${username}` }],
                  [{ text: "🖼 Profil rasmi", callback_data: `photo:${username}` }]
                ]
              }
            });
          } else {
            await sendTelegram(env, "sendMessage", {
              chat_id: chatId,
              text: "Username yuboring.\nMasalan: @username"
            });
          }
        }

        if (update.callback_query) {
          const q = update.callback_query;

          await sendTelegram(env, "answerCallbackQuery", {
            callback_query_id: q.id
          });

          await sendTelegram(env, "sendMessage", {
            chat_id: q.message.chat.id,
            text:
              "⏳ Bu username uchun Stories olish moduli hali ulanmagan.\n\n" +
              "Keyingi bosqichda Telegram va Instagram manbalarini ulaymiz."
          });
        }

        return new Response("OK");
      } catch (error) {
        console.log("BOT ERROR:", error.message);
        return new Response("Error", { status: 500 });
      }
    }

    return new Response("Yashirin Stories Bot");
  }
};

async function sendTelegram(env, method, data) {
  const response = await fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }
  );

  const result = await response.json();
  console.log("Telegram response:", JSON.stringify(result));

  return result;
}
