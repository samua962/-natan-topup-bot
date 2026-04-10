require("dotenv").config();

const bot = require("./bot/bot");
const adminApp = require("./admin/server");

const PORT = process.env.PORT || 5000;

// start express
adminApp.listen(PORT, () => {
    console.log("Admin API running on port", PORT);
});

// start bot
bot.launch();
console.log("Bot started");