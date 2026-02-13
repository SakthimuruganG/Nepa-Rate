const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

let isReady = false;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
});

client.on("qr", qr => {
  qrcode.generate(qr, { small: true });
  console.log("Scan QR in WhatsApp → Linked Devices");
});

client.on("ready", () => {
  console.log("✅ WhatsApp Ready");
  isReady = true;
});

client.initialize();

// Wait until ready before sending
async function sendMessage(text) {
  while (!isReady) {
    await new Promise(res => setTimeout(res, 1000));
  }

  await client.sendMessage("919487965619@c.us", text);
  console.log("📲 Message sent to WhatsApp");
}

module.exports = sendMessage;
