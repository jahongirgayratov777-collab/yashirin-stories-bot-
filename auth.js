
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input";

const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;
const phoneNumber = process.env.PHONE_NUMBER;

const client = new TelegramClient(
  new StringSession(""),
  apiId,
  apiHash,
  { connectionRetries: 5 }
);

async function main() {
  await client.start({
    phoneNumber: async () => phoneNumber,
    phoneCode: async () => await input.text("Telegram tasdiqlash kodi: "),
    password: async () => await input.text("2FA parolingiz: "),
    onError: (err) => console.log(err)
  });

  console.log("Telegram akkauntiga muvaffaqiyatli ulandi!");
  console.log("SESSION:", client.session.save());

  await client.disconnect();
}

main().catch(console.error);
