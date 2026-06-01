require("dotenv").config();
const { Telegraf } = require("telegraf");

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

(async () => {
    try {
        console.log("🔍 Testing emoji ID rendering...\n");
        
        // Test sending a message with icon_custom_emoji_id
        const testEmojis = [
            { name: "Wallet", id: "5373200942827066245" },
            { name: "Orders", id: "6109659543417917958" },
            { name: "PUBG", id: "5807693556910919020" },
            { name: "Free Fire", id: "6208452093397699863" },
        ];
        
        console.log("Testing emoji IDs in buttons:\n");
        
        const buttons = testEmojis.map((emoji) => [{
            text: emoji.name,
            callback_data: `test_${emoji.name}`,
            icon_custom_emoji_id: parseInt(emoji.id, 10)
        }]);
        
        await bot.telegram.sendMessage(
            process.env.ADMIN_ID,
            "🧪 Testing custom emoji rendering:\n\nClick buttons to verify emoji IDs are valid in your workspace:",
            {
                parse_mode: "HTML",
                reply_markup: { inline_keyboard: buttons }
            }
        );
        
        console.log("✅ Test message sent to admin!");
        console.log("\n📌 Check Telegram to see if custom emojis appear on buttons.");
        console.log("   - If you see custom emoji icons → IDs are VALID ✅");
        console.log("   - If you see fallback emoji → IDs are INVALID ❌");
        
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
})();
