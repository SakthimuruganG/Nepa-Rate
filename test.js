const sendMessage = require("./whatsapp");

setTimeout(() => {
  sendMessage("Test from Egg Bot 🥚");
}, 15000);
