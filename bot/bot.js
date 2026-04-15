require("dotenv").config();
const { Telegraf } = require("telegraf");
const db = require("../database/db");
const bot = new Telegraf(process.env.BOT_TOKEN);
const axios = require("axios");
const { createOrder, validatePlayer } = require("../services/ragner");

const userState = {};


const processingOrders = new Set(); // Track orders being processed to prevent double clicks
// =====================
// 🟢 PRICE ROUNDING FUNCTION
// =====================
function roundPrice(price) {
    const rounded = Math.round(price / 5) * 5;
    return Math.max(rounded, 5);
}

// =====================
// 🟢 GET PROFIT MARGIN FOR USD PRICE
// =====================
async function getProfitMargin(usdPrice) {
    try {
        const result = await db.query("SELECT value FROM settings WHERE key='profit_margins'");
        if (result.rows[0]?.value) {
            const margins = JSON.parse(result.rows[0].value);
            const range = margins.ranges.find(r => usdPrice >= r.min_usd && usdPrice <= r.max_usd);
            if (range) {
                return range.margin;
            }
        }
        return 10;
    } catch (error) {
        console.error("Profit margin error:", error);
        return 10;
    }
}

// =====================
// 🟢 BUILD ORDER DETAILS (for admin messages)
// =====================
function buildOrderDetails(order) {
    let details = `📦 ORDER #${order.id}\n`;
    details += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    // Telegram User Info
    if (order.telegram_username) {
        details += `👤 User: @${order.telegram_username}\n`;
    } else {
        details += `👤 User ID: ${order.telegram_id}\n`;
    }
    
    details += `📦 Product: ${order.product_name}\n`;
    details += `💰 Amount: ${order.price_etb} ETB\n`;
    details += `📅 Date: ${new Date(order.created_at).toLocaleString()}\n`;
    
    // Player Information
    if (order.player_id) {
        details += `\n🎮 Player ID: ${order.player_id}\n`;
    }
    if (order.player_name) {
        details += `👤 Player Name: ${order.player_name}\n`;
    }
    
    // User Inputs (for TikTok, Telegram Premium, etc.)
    if (order.user_inputs) {
        try {
            const inputs = JSON.parse(order.user_inputs);
            let hasInputs = false;
            let inputsText = "\n📋 USER INFORMATION:\n";
            
            if (inputs.email) {
                inputsText += `📧 Email: ${inputs.email}\n`;
                hasInputs = true;
            }
            if (inputs.phone) {
                inputsText += `📱 Phone: ${inputs.phone}\n`;
                hasInputs = true;
            }
            if (inputs.username) {
                inputsText += `👤 Username: ${inputs.username}\n`;
                hasInputs = true;
            }
            if (inputs.password) {
                inputsText += `🔐 Password: ${inputs.password}\n`;
                hasInputs = true;
            }
            if (inputs.player_id && !order.player_id) {
                inputsText += `🆔 Player ID: ${inputs.player_id}\n`;
                hasInputs = true;
            }
            if (inputs.player_name && !order.player_name) {
                inputsText += `👤 Player Name: ${inputs.player_name}\n`;
                hasInputs = true;
            }
            
            if (hasInputs) {
                details += inputsText;
            }
        } catch (e) {
            console.error("Error parsing user_inputs:", e);
        }
    }
    
    return details;
}
// =====================
// 🟢 GET MAIN MENU BANNER
// =====================
async function getMainMenuBanner() {
    try {
        const result = await db.query("SELECT value FROM settings WHERE key='main_menu_banner'");
        if (result.rows[0]?.value) {
            return result.rows[0].value;
        }
        return "https://assets-prd.ignimgs.com/2025/07/16/25-best-ps5-games-blogroll-1752704467824.jpg";
    } catch (error) {
        console.error("Get banner error:", error);
        return "https://assets-prd.ignimgs.com/2025/07/16/25-best-ps5-games-blogroll-1752704467824.jpg";
    }
}

// =====================
// 🟢 SAFE EDIT MESSAGE
// =====================
async function safeEdit(ctx, text, buttons) {
    try {
        if (ctx.callbackQuery && ctx.callbackQuery.message) {
            if (ctx.callbackQuery.message.photo) {
                return ctx.editMessageCaption(text, {
                    parse_mode: "Markdown",
                    reply_markup: { inline_keyboard: buttons }
                });
            } else {
                return ctx.editMessageText(text, {
                    parse_mode: "Markdown",
                    reply_markup: { inline_keyboard: buttons }
                });
            }
        } else {
            return ctx.reply(text, {
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard: buttons }
            });
        }
    } catch (error) {
        console.error("SafeEdit error:", error.message);
        return ctx.reply(text, {
            reply_markup: { inline_keyboard: buttons }
        });
    }
}

// =====================
// 🟢 SAFE EDIT MEDIA (for changing image)
// =====================
async function safeEditMedia(ctx, imageUrl, caption, buttons) {
    try {
        if (ctx.callbackQuery && ctx.callbackQuery.message) {
            await ctx.editMessageMedia({
                type: "photo",
                media: imageUrl,
                caption: caption,
                parse_mode: "Markdown"
            }, {
                reply_markup: { inline_keyboard: buttons }
            });
        } else {
            await ctx.replyWithPhoto(imageUrl, {
                caption: caption,
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard: buttons }
            });
        }
    } catch (error) {
        console.error("SafeEditMedia error:", error.message);
        await ctx.replyWithPhoto(imageUrl, {
            caption: caption,
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: buttons }
        });
    }
}

// =====================
// 🟢 BUTTON BUILDER (supports single column mode)
// =====================
function buildButtons(items, singleColumn = false) {
    const rows = [];
    if (singleColumn) {
        // Single column - one item per row
        for (let i = 0; i < items.length; i++) {
            rows.push([items[i]]);
        }
    } else {
        // Two columns - default
        for (let i = 0; i < items.length; i += 2) {
            rows.push(items.slice(i, i + 2));
        }
    }
    return rows;
}

// =====================
// 🟢 GET EXCHANGE RATE
// =====================
async function getExchangeRate() {
    try {
        const result = await db.query("SELECT value FROM settings WHERE key='exchange_rate'");
        if (result.rows[0]?.value) {
            return parseFloat(result.rows[0].value);
        }
        return 55;
    } catch (error) {
        console.error("Exchange rate error:", error);
        return 55;
    }
}

// =====================
// 🟢 GET PAYMENT METHODS
// =====================
async function getPaymentMethods() {
    try {
        const result = await db.query("SELECT value FROM settings WHERE key='payment_info'");
        if (result.rows[0]?.value) {
            const paymentInfo = JSON.parse(result.rows[0].value);
            return paymentInfo.methods || [];
        }
        return [];
    } catch (error) {
        console.error("Payment methods error:", error);
        return [];
    }
}

// =====================
// 🟢 SHOW RAGNER PRODUCTS (UC INSTANT)
// =====================
async function showRagnerProducts(ctx) {
    try {
        const res = await axios.get(
            "https://ragnergiftcard.com/api/v1/products?game=PUBG",
            { headers: { "X-API-KEY": process.env.RAGNER_API_KEY }, timeout: 10000 }
        );

        const rate = await getExchangeRate();
        
        const products = res.data.data.filter(p => {
            const name = p.name.toLowerCase();
            const ucMatch = p.name.match(/\d+/);
            const uc = ucMatch ? parseInt(ucMatch[0]) : 0;
            
            const excludeKeywords = ['card', 'web', 'prime', 'plus', 'weekly', 'deal', 'pack', 'bundle', 'chest', 'crate'];
            const isExcluded = excludeKeywords.some(keyword => name.includes(keyword));
            
            return !isExcluded && uc >= 60 && uc <= 1800;
        });
        
        products.sort((a, b) => {
            const ucA = parseInt(a.name.match(/\d+/) || 0);
            const ucB = parseInt(b.name.match(/\d+/) || 0);
            return ucA - ucB;
        });

        if (products.length === 0) {
            await safeEdit(ctx, "📭 No instant products available.", [[{ text: "🔙 Back", callback_data: "back_main" }]]);
            return;
        }

        const productButtons = [];
        for (const p of products) {
            const margin = await getProfitMargin(p.price);
            const priceWithMargin = p.price * (1 + (margin / 100));
            let priceETB = Math.round(priceWithMargin * rate);
            priceETB = roundPrice(priceETB);
            productButtons.push({
                text: `${p.name} - ${priceETB} ETB`,
                callback_data: `ragner_${p.id}_${priceETB}_${p.name.replace(/ /g, "_")}`
            });
        }

        const buttons = buildButtons(productButtons);
        buttons.push([{ text: "🔙 Back", callback_data: "back_main" }]);
        
        await safeEdit(ctx, "⚡ *PUBG UC Instant Delivery*\n\n*Max: 1800 UC*\n\nSelect UC amount:", buttons);
    } catch (error) {
        console.error("Ragner products error:", error);
        await safeEdit(ctx, "⏳ Service busy. Please try again.", [[{ text: "🔙 Back", callback_data: "back_main" }]]);
    }
}

// =====================
// 🟢 SHOW DATABASE PRODUCTS
// =====================
async function showDatabaseProducts(ctx, subId) {
    try {
        const result = await db.query(
            `SELECT * FROM products 
             WHERE subcategory_id = $1 AND is_active = true 
             ORDER BY position ASC, id ASC`,
            [subId]
        );

        if (result.rows.length === 0) {
            await safeEdit(ctx, "📭 No products available right now.", [[{ text: "🔙 Back", callback_data: "back_main" }]]);
            return;
        }

        const productType = result.rows[0]?.product_type;
        
        // Use single column for grospack and subscription
        const useSingleColumn = productType === "grospack" || productType === "subscription";
        
        const buttons = buildButtons(
            result.rows.map(p => ({
                text: `${p.name} - ${p.price_etb} ETB`,
                callback_data: `db_${p.id}_${p.price_etb}_${p.product_type}_${p.name.replace(/ /g, "_")}`
            })),
            useSingleColumn
        );

        buttons.push([{ text: "🔙 Back", callback_data: "back_main" }]);
        
        let title = "📦 *Select Product:*";
        if (productType === "grospack") title = "🎁 *Grospack Options:*";
        if (productType === "subscription") title = "👑 *Subscription Plans:*";
        if (productType === "free_fire") title = "🔥 *Free Fire Diamonds:*";
        if (productType === "tiktok") title = "📱 *TikTok Coins:*";
        if (productType === "telegram") title = "✍️ *Telegram Premium:*";
        
        await safeEdit(ctx, title, buttons);
    } catch (error) {
        console.error("Database products error:", error);
        await safeEdit(ctx, "⚠️ Error loading products.", [[{ text: "🔙 Back", callback_data: "back_main" }]]);
    }
}

// =====================
// 🟢 SHOW PRODUCTS BY CATEGORY (for categories without subcategories)
// =====================
async function showProductsByCategory(ctx, categoryId) {
    try {
        const categoryResult = await db.query(
            "SELECT * FROM categories WHERE id = $1 AND is_active = true",
            [categoryId]
        );
        const category = categoryResult.rows[0];
        
        const result = await db.query(
            `SELECT * FROM products 
             WHERE category_id = $1 AND is_active = true 
             ORDER BY position ASC, id ASC`,
            [categoryId]
        );

        if (result.rows.length === 0) {
            await safeEdit(ctx, "📭 No products available right now.", [[{ text: "🔙 Back", callback_data: "back_main" }]]);
            return;
        }

        const buttons = buildButtons(
            result.rows.map(p => ({
                text: `${p.name} - ${p.price_etb} ETB`,
                callback_data: `db_${p.id}_${p.price_etb}_${p.product_type}_${p.name.replace(/ /g, "_")}`
            }))
        );

        buttons.push([{ text: "🔙 Back", callback_data: "back_main" }]);
        
        let title = "📦 *Select Product:*";
        if (result.rows[0]?.product_type === "free_fire") title = "🔥 *Free Fire Diamonds:*";
        if (result.rows[0]?.product_type === "tiktok") title = "📱 *TikTok Coins:*";
        if (result.rows[0]?.product_type === "telegram") title = "✍️ *Telegram Premium:*";
        
        const categoryImage = category?.image_url || "https://assets-prd.ignimgs.com/2025/07/16/25-best-ps5-games-blogroll-1752704467824.jpg";
        
        await safeEditMedia(ctx, categoryImage, title, buttons);
    } catch (error) {
        console.error("Products by category error:", error);
        await safeEdit(ctx, "⚠️ Error loading products.", [[{ text: "🔙 Back", callback_data: "back_main" }]]);
    }
}

// =====================
// 🟢 SHOW WARNING MESSAGE (for TikTok)
// =====================
async function showWarningMessage(ctx, product) {
    const warning = product.warning_message || 
        "⚠️ *IMPORTANT SECURITY NOTICE*\n\n" +
        "• Please turn off 2-step verification before sharing\n" +
        "• Your credentials are safe and secure\n" +
        "• We will only access your account to add coins\n" +
        "• Change your password after delivery for extra security\n\n" +
        "Do you understand and wish to continue?";
    
    const buttons = [
        [{ text: "✅ I Understand, Continue", callback_data: `continue_${product.id}` }],
        [{ text: "❌ Cancel", callback_data: "confirm_no" }]
    ];
    
    await ctx.reply(warning, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: buttons }
    });
}

// =====================
// 🟢 ASK FOR FIELDS BASED ON PRODUCT TYPE
// =====================
async function askForFields(ctx, product) {
    const state = userState[ctx.from.id];
    const productType = product.product_type;
    
    if (!state.requiredFields || state.requiredFields.length === 0) {
        if (productType === "free_fire" || productType === "uc_manual" || productType === "grospack" || productType === "subscription") {
            state.requiredFields = ["player_id"];
        } else if (productType === "tiktok") {
            state.requiredFields = ["email", "phone", "password"];
        } else if (productType === "telegram") {
            state.requiredFields = ["username", "phone"];
        } else if (productType === "uc_instant") {
            state.requiredFields = ["player_id"];
        } else {
            state.requiredFields = ["player_id"];
        }
    }
    
    state.currentField = 0;
    state.collectedData = {};
    state.step = "PLAYER";
    
    const firstField = state.requiredFields[0];
    const prompts = {
        email: "📧 *Enter TikTok Email:*",
        phone: "📱 *Enter Phone Number:*",
        password: "🔐 *Enter Password:*\n\n⚠️ Your credentials are safe and secure",
        username: "👤 *Enter Telegram Username:*\n\nExample: @username",
        player_id: "🎮 *Enter Player ID:*\n\nExample: 123456789"
    };
    
    const message = prompts[firstField] || `Enter ${firstField}:`;
    await ctx.reply(message, { parse_mode: "Markdown" });
}

// =====================
// 🟢 PROCESS FIELD INPUT
// =====================
async function processFieldInput(ctx, product, state, input) {
    const fields = state.requiredFields;
    const currentField = fields[state.currentField];
    
    state.collectedData[currentField] = input;
    state.currentField++;
    
    if (state.currentField < fields.length) {
        const nextField = fields[state.currentField];
        const prompts = {
            email: "📧 *Enter TikTok Email:*",
            phone: "📱 *Enter Phone Number:*",
            password: "🔐 *Enter Password:*\n\n⚠️ Your credentials are safe and secure",
            username: "👤 *Enter Telegram Username:*\n\nExample: @username",
            player_id: "🎮 *Enter Player ID:*\n\nExample: 123456789"
        };
        return ctx.reply(prompts[nextField] || `Enter ${nextField}:`, { parse_mode: "Markdown" });
    }
    
    let confirmMessage = "✅ *Please confirm your information:*\n\n";
    
    if (product.product_type === "tiktok") {
        confirmMessage += `📧 Email: ${state.collectedData.email}\n`;
        confirmMessage += `📱 Phone: ${state.collectedData.phone}\n`;
        confirmMessage += `🔐 Password: ${'•'.repeat(state.collectedData.password.length)}\n\n`;
    } else if (product.product_type === "telegram") {
        confirmMessage += `👤 Username: ${state.collectedData.username}\n`;
        confirmMessage += `📱 Phone: ${state.collectedData.phone}\n\n`;
    } else {
        confirmMessage += `🆔 Player ID: ${state.collectedData.player_id}\n\n`;
    }
    
    confirmMessage += `Is this correct?`;
    
    state.step = "CONFIRM";
    
    await ctx.reply(confirmMessage, {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "✅ Yes", callback_data: "confirm_yes" },
                    { text: "❌ No", callback_data: "confirm_no" }
                ]
            ]
        }
    });
}

// =====================
// 🟢 SHOW PAYMENT METHODS
// =====================
async function showPaymentMethods(ctx, productInfo) {
    const methods = await getPaymentMethods();
    
    if (methods.length === 0) {
        await ctx.reply("⚠️ Payment methods not configured. Please contact support.");
        return false;
    }

    const buttons = methods.map(m => [
        { text: m.name, callback_data: `payment_${m.id}_${productInfo.productId}_${productInfo.price}_${productInfo.name.replace(/ /g, "_")}` }
    ]);
    
    buttons.push([{ text: "❌ Cancel", callback_data: "confirm_no" }]);

    await ctx.editMessageText("💳 *Select Payment Method:*", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: buttons }
    });
    
    return true;
}

// =====================
// 🟢 SHOW PAYMENT DETAILS
// =====================
async function showPaymentDetails(ctx, paymentMethod, productInfo) {
    const details = `💳 *Payment Details*

📦 Product: ${productInfo.name}
💰 Amount: ${productInfo.price} ETB

🏦 ${paymentMethod.name}
📞 Account: ${paymentMethod.account_number}
👤 Name: ${paymentMethod.account_name || "N/A"}

${paymentMethod.instructions || "Send payment screenshot here after transfer"}

⚠️ *Send the screenshot in this chat*`;

    const userId = ctx.from.id;
    if (!userState[userId]) userState[userId] = {};
    userState[userId].paymentMethod = paymentMethod;
    userState[userId].productInfo = productInfo;
    userState[userId].step = "PAY";

    await ctx.editMessageText(details, { parse_mode: "Markdown" });
}

// =====================
// 🟢 SHOW MAIN MENU - REPLACES CURRENT MESSAGE
// =====================
async function showMainMenu(ctx) {
    try {
        const categories = await db.query(
            "SELECT * FROM categories WHERE is_active=true AND name NOT IN ('channel', 'information', 'info') ORDER BY position"
        );

        const buttons = buildButtons(
            categories.rows.map(c => ({
                text: c.display_name,
                callback_data: `cat_${c.id}`
            }))
        );
        
        buttons.push([
            { text: "📋 My Orders", callback_data: "myorders_back" },
            { text: "📞 Support", callback_data: "support_menu" }
        ]);
        buttons.push([
            { text: "📢 Our Channel", url: `https://t.me/${process.env.CHANNEL_USERNAME?.replace('@', '') || "natan_topup"}` },
            { text: "ℹ️ Info", callback_data: "info_menu" }
        ]);
        buttons.push([
            { text: "❓ Help", callback_data: "help_menu" }
        ]);

        const mainMenuBanner = await getMainMenuBanner();
        const caption = `🎮 Natan Top Up\n\n⚡ Fast • Secure • Reliable\n\nSelect a service below 👇`;

        // Check if this is a callback query (edit existing message) or new message
        if (ctx.callbackQuery && ctx.callbackQuery.message) {
            // Edit existing message
            await safeEditMedia(ctx, mainMenuBanner, caption, buttons);
        } else {
            // Send new message (for /start command)
            await ctx.replyWithPhoto(mainMenuBanner, {
                caption: caption,
                reply_markup: { inline_keyboard: buttons }
            });
        }
    } catch (error) {
        console.error("Show main menu error:", error);
        await ctx.reply("⚠️ System error. Please try /start again.");
    }
}

// =====================
// 🟢 MY ORDERS COMMAND
// =====================
function getStatusEmoji(status) {
    const statusMap = {
        'PENDING': '⏳',
        'APPROVED': '✅',
        'COMPLETED': '🎉',
        'REJECTED': '❌'
    };
    return statusMap[status] || '📦';
}

function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

bot.command("myorders", async (ctx) => {
    const userId = ctx.from.id;
    
    try {
        const orders = await db.query(
            `SELECT id, product_name, price_etb, status, created_at, delivery_type 
             FROM orders 
             WHERE telegram_id = $1 
             ORDER BY id DESC 
             LIMIT 20`,
            [userId]
        );
        
        if (orders.rows.length === 0) {
            return ctx.reply("📭 *No orders found.*\n\nUse /start to place your first order!", {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [[{ text: "🛒 Start Shopping", callback_data: "back_main" }]]
                }
            });
        }
        
        let message = "📋 *YOUR ORDERS*\n\n";
        
        for (let i = 0; i < orders.rows.length; i++) {
            const o = orders.rows[i];
            const emoji = getStatusEmoji(o.status);
            message += `${i + 1}. ${emoji} *#${o.id}* - ${o.product_name}\n`;
            message += `   💰 ${o.price_etb} ETB | ${o.status}\n`;
            message += `   📅 ${formatDate(o.created_at)}\n\n`;
        }
        
        message += "Click an order below to see details 👇";
        
        const buttons = orders.rows.slice(0, 10).map(o => [
            { text: `📦 Order #${o.id} - ${o.status}`, callback_data: `order_detail_${o.id}` }
        ]);
        
        buttons.push([{ text: "🔙 Back to Menu", callback_data: "back_main" }]);
        
        await ctx.reply(message, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: buttons }
        });
        
    } catch (error) {
        console.error("My orders error:", error);
        await ctx.reply("⚠️ Error loading your orders. Please try again.");
    }
});

async function showOrderDetail(ctx, orderId) {
    const userId = ctx.from.id;
    
    try {
        const order = await db.query(
            `SELECT * FROM orders WHERE id = $1 AND telegram_id = $2`,
            [orderId, userId]
        );
        
        if (order.rows.length === 0) {
            return ctx.reply("❌ Order not found.");
        }
        
        const o = order.rows[0];
        const emoji = getStatusEmoji(o.status);
        
        let message = `${emoji} *ORDER #${o.id} DETAILS*\n\n`;
        message += `📦 Product: ${o.product_name}\n`;
        message += `💰 Amount: ${o.price_etb} ETB\n`;
        message += `📊 Status: ${o.status}\n`;
        message += `📅 Date: ${formatDate(o.created_at)}\n`;
        
        if (o.player_id) {
            message += `\n🎮 Player ID: ${o.player_id}\n`;
        }
        if (o.player_name) {
            message += `👤 Player Name: ${o.player_name}\n`;
        }
        
        if (o.user_inputs) {
            try {
                const inputs = JSON.parse(o.user_inputs);
                message += `\n📋 *Your Information:*\n`;
                if (inputs.email) message += `📧 Email: ${inputs.email}\n`;
                if (inputs.phone) message += `📱 Phone: ${inputs.phone}\n`;
                if (inputs.username) message += `👤 Username: ${inputs.username}\n`;
                if (inputs.player_id) message += `🆔 Player ID: ${inputs.player_id}\n`;
            } catch (e) {}
        }
        
        let statusMessage = "";
        if (o.status === "PENDING") {
            statusMessage = "\n⏳ *Your order is pending approval.* We'll notify you once approved.";
        } else if (o.status === "APPROVED") {
            statusMessage = "\n✅ *Payment approved!* Delivery in progress...";
        } else if (o.status === "COMPLETED") {
            statusMessage = "\n🎉 *Order completed!* Thank you for shopping with us!";
        } else if (o.status === "REJECTED") {
            statusMessage = "\n❌ *Order rejected.* Please contact support.";
        }
        
        message += statusMessage;
        
        const buttons = [
            [{ text: "🔙 Back to My Orders", callback_data: "myorders_back" }],
            [{ text: "🏠 Main Menu", callback_data: "back_main" }]
        ];
        
        await ctx.editMessageText(message, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: buttons }
        });
        
    } catch (error) {
        console.error("Order detail error:", error);
        await ctx.reply("⚠️ Error loading order details.");
    }
}

bot.command("support", async (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    
    const message = `📞 CONTACT SUPPORT\n\n` +
        `Having issues with your order? Need help?\n\n` +
        `📱 Telegram: ${process.env.ADMIN_USERNAME || "Contact Admin"}\n` +
        `✉️ Response Time: Usually within 1 hour\n\n` +
        `Send us a message below and we'll help you!`;
    
    const buttons = [
        [{ text: "📩 Message Admin", url: `https://t.me/${process.env.ADMIN_USERNAME?.replace('@', '') || "natan_topup"}` }],
        [{ text: "📋 My Orders", callback_data: "myorders_back" }],
        [{ text: "🏠 Main Menu", callback_data: "back_main" }]
    ];
    
    await ctx.reply(message, {
        reply_markup: { inline_keyboard: buttons }
    });
    
    await ctx.telegram.sendMessage(
        process.env.ADMIN_ID,
        `📞 Support Request\n\n👤 User: ${username}\n🆔 ID: ${userId}\n\nUser requested support.`
    );
});

bot.command("channel", async (ctx) => {
    const channelUsername = process.env.CHANNEL_USERNAME || "natan_topup";
    const channelLink = `https://t.me/${channelUsername.replace('@', '')}`;
    
    const message = `📢 OUR OFFICIAL CHANNEL\n\n` +
        `Join our Telegram channel for:\n\n` +
        `✅ Latest updates & offers\n` +
        `✅ Promo codes & discounts\n` +
        `✅ New product announcements\n` +
        `✅ Giveaways & events\n\n` +
        `Click the button below to join!`;
    
    const buttons = [
        [{ text: "📢 Join Our Channel", url: channelLink }],
        [{ text: "🏠 Main Menu", callback_data: "back_main" }]
    ];
    
    await ctx.reply(message, {
        reply_markup: { inline_keyboard: buttons }
    });
});

bot.command("info", async (ctx) => {
    const message = `ℹ️ ABOUT NATAN TOP UP

Version: 2.0.0
Platform: Telegram Bot

FEATURES:
✅ 24/7 Automated Service
✅ Instant & Manual Delivery
✅ Secure Payment Processing
✅ Order Tracking
✅ Customer Support

SUPPORTED GAMES & SERVICES:
🎮 PUBG UC (Instant & Manual)
🎮 Free Fire Diamonds
📱 TikTok Coins
✍️ Telegram Premium

Contact: ${process.env.ADMIN_USERNAME || "@admin"}

Thank you for choosing Natan Top Up! 🚀`;
    
    const buttons = [
        [{ text: "📢 Our Channel", url: `https://t.me/${process.env.CHANNEL_USERNAME?.replace('@', '') || "natan_topup"}` }],
        [{ text: "📞 Support", callback_data: "support_menu" }],
        [{ text: "🏠 Main Menu", callback_data: "back_main" }]
    ];
    
    await ctx.reply(message, {
        reply_markup: { inline_keyboard: buttons }
    });
});

bot.command("help", async (ctx) => {
    const message = `❓ *HELP & GUIDE*\n\n` +
        `*Commands:*\n` +
        `/start - Main menu\n` +
        `/myorders - View your orders\n` +
        `/support - Contact support\n` +
        `/channel - Join our channel\n` +
        `/info - About this bot\n` +
        `/help - Show this message\n\n` +
        `*How to Order:*\n` +
        `1. Select a category\n` +
        `2. Choose a product\n` +
        `3. Enter your ID/credentials\n` +
        `4. Confirm information\n` +
        `5. Select payment method\n` +
        `6. Send payment screenshot\n\n` +
        `*Need help?* Use /support to contact us!`;
    
    await ctx.reply(message, { parse_mode: "Markdown" });
});

// =====================
// 🟢 START COMMAND
// =====================
bot.start(async (ctx) => {
    delete userState[ctx.from.id];
    await showMainMenu(ctx);
});

// =====================
// 🟢 CALLBACK QUERY
// =====================
bot.on("callback_query", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
// Handle noop (do nothing)
// Handle noop (do nothing button - prevents double clicks)
if (data === "noop") {
    return ctx.answerCbQuery("Please wait...");
}
    if (!userState[userId]) userState[userId] = {};
    const state = userState[userId];

    await ctx.answerCbQuery();

    // MY ORDERS BACK
    if (data === "myorders_back") {
        return bot.telegram.sendMessage(ctx.from.id, "/myorders");
    }

    // ORDER DETAIL
    if (data.startsWith("order_detail_")) {
        const orderId = data.split("_")[2];
        return showOrderDetail(ctx, orderId);
    }

    // SUPPORT MENU
    if (data === "support_menu") {
        return bot.telegram.sendMessage(ctx.from.id, "/support");
    }

    // INFO MENU
    if (data === "info_menu") {
        return bot.telegram.sendMessage(ctx.from.id, "/info");
    }

    // HELP MENU
    if (data === "help_menu") {
        return bot.telegram.sendMessage(ctx.from.id, "/help");
    }

    // CATEGORY - REPLACE current message with category image
    if (data.startsWith("cat_")) {
        const categoryId = data.split("_")[1];
        
        const categoryResult = await db.query(
            "SELECT * FROM categories WHERE id = $1 AND is_active = true",
            [categoryId]
        );
        
        const category = categoryResult.rows[0];
        if (!category) {
            return ctx.reply("❌ Category not found.");
        }
        
        const subs = await db.query(
            "SELECT * FROM subcategories WHERE category_id=$1 AND is_active=true ORDER BY position",
            [categoryId]
        );

        const buttons = buildButtons(
            subs.rows.map(s => ({
                text: s.display_name,
                callback_data: `sub_${s.id}_${s.name}`
            }))
        );

        buttons.push([{ text: "🔙 Back", callback_data: "back_main" }]);
        
        const categoryImage = category.image_url || "https://assets-prd.ignimgs.com/2025/07/16/25-best-ps5-games-blogroll-1752704467824.jpg";
        const caption = `📂 *${category.display_name}*\n\nSelect an option below 👇`;
        
        // If no subcategories, show products directly
        if (subs.rows.length === 0) {
            return showProductsByCategory(ctx, categoryId);
        }
        
        // Replace current message with category image and subcategory buttons
        await safeEditMedia(ctx, categoryImage, caption, buttons);
        return;
    }

    // SUBCATEGORY
    if (data.startsWith("sub_")) {
        const [, subId, name] = data.split("_");
        
        if (name === "instant") {
            state.mode = "instant";
            return showRagnerProducts(ctx);
        } else {
            state.mode = "database";
            return showDatabaseProducts(ctx, subId);
        }
    }

    // RAGNER PRODUCT
    if (data.startsWith("ragner_")) {
        const parts = data.split("_");
        const id = parts[1];
        const price = parts[2];
        const name = parts.slice(3).join(" ");

        state.product = {
            id: id,
            price: parseFloat(price),
            name: name,
            type: "ragner",
            product_type: "uc_instant"
        };
        state.step = "PLAYER";
        return ctx.reply("🎮 *Enter Player ID:*\n\nExample: 123456789", { parse_mode: "Markdown" });
    }

    // DATABASE PRODUCT
    if (data.startsWith("db_")) {
        const parts = data.split("_");
        const productId = parts[1];
        const price = parts[2];
        const productType = parts[3];
        const name = parts.slice(4).join(" ");

        const productResult = await db.query(
            "SELECT * FROM products WHERE id = $1",
            [productId]
        );
        
        const product = productResult.rows[0];
        
        if (!product) {
            await ctx.reply("❌ Product not found.");
            return;
        }

        state.product = {
            id: productId,
            price: parseFloat(price),
            name: name,
            type: "database",
            product_type: productType,
            fullProduct: product
        };
        
        if (productType === "tiktok" && product.warning_message && product.warning_message !== "none") {
            return showWarningMessage(ctx, product);
        }
        
        return askForFields(ctx, product);
    }
    
    // CONTINUE AFTER WARNING
    if (data.startsWith("continue_")) {
        const product = state.product?.fullProduct;
        if (product) {
            return askForFields(ctx, product);
        }
    }

    // PAYMENT METHOD SELECTION
    if (data.startsWith("payment_")) {
        const parts = data.split("_");
        const methodId = parseInt(parts[1]);
        const productId = parts[2];
        const price = parts[3];
        const name = parts.slice(4).join(" ");

        const methods = await getPaymentMethods();
        const selectedMethod = methods.find(m => m.id === methodId);

        if (!selectedMethod) {
            await ctx.reply("❌ Payment method not found.");
            return;
        }

        const productInfo = {
            productId: productId,
            price: parseFloat(price),
            name: name
        };

        await showPaymentDetails(ctx, selectedMethod, productInfo);
    }

    // CONFIRM YES
    if (data === "confirm_yes") {
        if (state.product) {
            state.step = "PAY";
            const methods = await getPaymentMethods();
            if (methods.length === 0) {
                return ctx.reply("⚠️ Payment methods not configured. Contact support.");
            }
            const productInfo = {
                productId: state.product.id,
                price: state.product.price,
                name: state.product.name
            };
            return showPaymentMethods(ctx, productInfo);
        }
    }

    // CANCEL
    if (data === "confirm_no") {
        delete userState[userId];
        return ctx.editMessageText("❌ Order cancelled. Type /start to begin again.");
    }

    // BACK TO MAIN - REPLACE current message with main menu
    if (data === "back_main") {
        delete userState[userId];
        return showMainMenu(ctx);
    }

   // Track processing orders to prevent double processing
const processingOrders = new Set();

// ADMIN: APPROVE - WITH DOUBLE-CLICK PROTECTION
// ADMIN: APPROVE - WITH DOUBLE-CLICK PROTECTION
if (data.startsWith("approve_")) {
    const orderId = data.split("_")[1];
    
    // Check if this order is already being processed
    if (processingOrders.has(orderId)) {
        console.log(`Order ${orderId} is already being processed, ignoring duplicate click`);
        return ctx.answerCbQuery("Processing... Please wait.");
    }
    
    // Mark this order as processing
    processingOrders.add(orderId);
    
    // Immediately update the button to show "Processing..." to prevent double click
    await ctx.editMessageReplyMarkup({
        inline_keyboard: [
            [{ text: "⏳ Processing...", callback_data: "noop" }],
            [{ text: "❌ Reject Order", callback_data: `reject_${orderId}` }]
        ]
    });

    try {
        const order = (await db.query("SELECT * FROM orders WHERE id=$1", [orderId])).rows[0];
        if (!order) {
            processingOrders.delete(orderId);
            return ctx.editMessageCaption("❌ Order not found");
        }

        // Build order details using the helper function
        let orderDetails = buildOrderDetails(order);

        // Update status to APPROVED
        await db.query("UPDATE orders SET status='APPROVED' WHERE id=$1", [orderId]);

        // Handle Ragner instant delivery
        if (order.delivery_type === "ragner") {
            console.log(`[Order ${orderId}] Processing instant delivery`);
            console.log(`[Order ${orderId}] Product ID: ${order.external_product_id}`);
            console.log(`[Order ${orderId}] Player ID: ${order.player_id}`);
            
            const validation = await validatePlayer(order.external_product_id, order.player_id);
            
            if (!validation || !validation.success) {
                console.log(`[Order ${orderId}] Player validation failed`);
                
                await ctx.telegram.sendMessage(order.telegram_id, 
                    "⚠️ Payment approved but player validation failed. Contact support.", 
                    { parse_mode: "Markdown" });
                
                processingOrders.delete(orderId);
                
                return ctx.editMessageCaption(
                    `${orderDetails}\n━━━━━━━━━━━━━━━━━━━━\n` +
                    `⚠️ STATUS: APPROVED (Validation Failed)\n` +
                    `❌ Auto-delivery unavailable. Please deliver manually.\n\n` +
                    `👇 Click "Complete" after manual delivery`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "🎮 Complete Delivery", callback_data: `complete_${orderId}` }],
                                [{ text: "❌ Reject Order", callback_data: `reject_${orderId}` }]
                            ]
                        }
                    }
                );
            }
            
            const result = await createOrder(order.external_product_id, order.player_id);
            
            if (result && result.success) {
                await db.query("UPDATE orders SET status='COMPLETED' WHERE id=$1", [orderId]);
                await ctx.telegram.sendMessage(order.telegram_id, "🎮 *UC Delivered Successfully!*", { parse_mode: "Markdown" });
                
                processingOrders.delete(orderId);
                
                return ctx.editMessageCaption(
                    `${orderDetails}\n━━━━━━━━━━━━━━━━━━━━\n` +
                    `✅ STATUS: COMPLETED\n` +
                    `🎮 UC Delivered Successfully!`
                );
            } else {
                const errorMsg = result?.error || result?.details?.message || "Unknown error";
                console.error(`[Order ${orderId}] Auto-delivery failed: ${errorMsg}`);
                
                await ctx.telegram.sendMessage(order.telegram_id, 
                    "✅ Payment approved! Delivery in progress.", 
                    { parse_mode: "Markdown" });
                
                processingOrders.delete(orderId);
                
                return ctx.editMessageCaption(
                    `${orderDetails}\n━━━━━━━━━━━━━━━━━━━━\n` +
                    `⚠️ STATUS: APPROVED\n` +
                    `❌ Auto-delivery failed: ${errorMsg}\n\n` +
                    `👇 Click "Complete" after manual delivery`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "🎮 Complete Delivery", callback_data: `complete_${orderId}` }],
                                [{ text: "❌ Reject Order", callback_data: `reject_${orderId}` }]
                            ]
                        }
                    }
                );
            }
        }

        // Manual delivery
        await ctx.telegram.sendMessage(order.telegram_id, "✅ Payment approved! Delivery in progress.", { parse_mode: "Markdown" });
        
        processingOrders.delete(orderId);
        
        await ctx.editMessageCaption(
            `${orderDetails}\n━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ STATUS: APPROVED\n` +
            `📦 Manual delivery - click "Complete" after delivering`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🎮 Complete Delivery", callback_data: `complete_${orderId}` }],
                        [{ text: "❌ Reject Order", callback_data: `reject_${orderId}` }]
                    ]
                }
            }
        );

    } catch (error) {
        console.error("Approve error:", error);
        processingOrders.delete(orderId);
        await ctx.editMessageCaption(`❌ Error processing approval: ${error.message}`);
    }
}
  // ADMIN: COMPLETE - WITH DOUBLE-CLICK PROTECTION
if (data.startsWith("complete_")) {
    const orderId = data.split("_")[1];
    
    if (processingOrders.has(orderId)) {
        return ctx.answerCbQuery("Processing... Please wait.");
    }
    
    processingOrders.add(orderId);
    
    await ctx.editMessageReplyMarkup({
        inline_keyboard: [[{ text: "⏳ Processing...", callback_data: "noop" }]]
    });

    try {
        const order = (await db.query("SELECT * FROM orders WHERE id=$1", [orderId])).rows[0];
        if (!order) {
            processingOrders.delete(orderId);
            return ctx.editMessageCaption("❌ Order not found");
        }

        let orderDetails = buildOrderDetails(order);

        await db.query("UPDATE orders SET status='COMPLETED' WHERE id=$1", [orderId]);
        await ctx.telegram.sendMessage(order.telegram_id, "🎮 *Order Delivered Successfully!*", { parse_mode: "Markdown" });
        
        processingOrders.delete(orderId);
        
        await ctx.editMessageCaption(
            `${orderDetails}\n━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ STATUS: COMPLETED\n` +
            `🎮 Order delivered successfully!`
        );

    } catch (error) {
        console.error("Complete error:", error);
        processingOrders.delete(orderId);
        await ctx.editMessageCaption("⚠️ Error completing order");
    }
}
// ADMIN: REJECT - WITH DOUBLE-CLICK PROTECTION
if (data.startsWith("reject_")) {
    const orderId = data.split("_")[1];
    
    if (processingOrders.has(orderId)) {
        return ctx.answerCbQuery("Processing... Please wait.");
    }
    
    processingOrders.add(orderId);
    
    await ctx.editMessageReplyMarkup({
        inline_keyboard: [[{ text: "⏳ Processing...", callback_data: "noop" }]]
    });

    try {
        const order = (await db.query("SELECT * FROM orders WHERE id=$1", [orderId])).rows[0];
        if (!order) {
            processingOrders.delete(orderId);
            return ctx.editMessageCaption("❌ Order not found");
        }

        let orderDetails = buildOrderDetails(order);

        await db.query("UPDATE orders SET status='REJECTED' WHERE id=$1", [orderId]);
        await ctx.telegram.sendMessage(order.telegram_id, "❌ Payment rejected. Please contact support.", { parse_mode: "Markdown" });
        
        processingOrders.delete(orderId);
        
        await ctx.editMessageCaption(
            `${orderDetails}\n━━━━━━━━━━━━━━━━━━━━\n` +
            `❌ STATUS: REJECTED`
        );

    } catch (error) {
        console.error("Reject error:", error);
        processingOrders.delete(orderId);
        await ctx.editMessageCaption("⚠️ Error rejecting order");
    }
}
});

// =====================
// 🟢 TEXT MESSAGE
// =====================
bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const state = userState[userId];
    
    if (!state || state.step !== "PLAYER") return;
    
    const input = ctx.message.text.trim();
    const product = state.product?.fullProduct;
    
    if (!input) {
        return ctx.reply("❌ Invalid input. Please try again.");
    }
    
    if (state.requiredFields && state.requiredFields.length > 0 && state.currentField !== undefined) {
        return processFieldInput(ctx, product, state, input);
    }
    
    if (state.product?.type === "ragner" || (state.requiredFields && state.requiredFields.length === 1)) {
        if (state.requiredFields && state.requiredFields.length === 1) {
            const fieldName = state.requiredFields[0];
            state.collectedData = {};
            state.collectedData[fieldName] = input;
            state.playerId = input;
            state.playerName = "User Input";
        } else {
            state.playerId = input;
            state.playerName = "User Input";
        }
        
        if (state.product?.type === "ragner") {
            try {
                const validation = await validatePlayer(state.product.id, input);
                
                if (!validation || !validation.success) {
                    return ctx.reply("❌ *Invalid Player ID.*\n\nPlayer not found. Please check and try again.", { parse_mode: "Markdown" });
                }
                
                state.playerName = validation.data?.nickname || "Unknown Player";
            } catch (error) {
                console.error("Validation error:", error);
                return ctx.reply("⏳ *Service busy.* Please try again in 2 minutes.", { parse_mode: "Markdown" });
            }
        }
        
        state.step = "CONFIRM";
        
        let confirmMessage = `🎮 *Verification*\n\n`;
        if (state.product?.type === "ragner") {
            confirmMessage += `👤 Name: ${state.playerName}\n`;
        }
        confirmMessage += `🆔 ID: ${input}\n\nIs this correct?`;
        
        return ctx.reply(confirmMessage, {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[
                    { text: "✅ Yes", callback_data: "confirm_yes" },
                    { text: "❌ No", callback_data: "confirm_no" }
                ]]
            }
        });
    }
});


// =====================
// 🟢 PHOTO MESSAGE (PAYMENT SCREENSHOT)
// =====================
// Inside bot.on("photo") - Update the order insertion
bot.on("photo", async (ctx) => {
    const userId = ctx.from.id;
    const state = userState[userId];
    
    if (!state || state.step !== "PAY") {
        return ctx.reply("⚠️ Please start a new order with /start");
    }

    try {
        const fileId = ctx.message.photo.pop().file_id;
        const username = ctx.from.username ? `@${ctx.from.username}` : `${ctx.from.first_name} (${userId})`;
        
        let userInputs = {};
        let extractedPlayerId = null;
        let extractedPlayerName = null;
        
        if (state.collectedData) {
            userInputs = state.collectedData;
            // Extract player_id from collectedData if exists
            if (state.collectedData.player_id) {
                extractedPlayerId = state.collectedData.player_id;
                extractedPlayerName = state.collectedData.player_name || null;
            }
        }
        
        // Also check state.playerId (for Ragner products)
        if (state.playerId && !extractedPlayerId) {
            extractedPlayerId = state.playerId;
            extractedPlayerName = state.playerName || null;
        }
        
        // If still no player_id, check if it's in userInputs
        if (!extractedPlayerId && userInputs.player_id) {
            extractedPlayerId = userInputs.player_id;
            extractedPlayerName = userInputs.player_name || null;
        }

        const result = await db.query(
            `INSERT INTO orders 
          (telegram_id, telegram_username, product_id, external_product_id, product_name, price_etb, 
     player_id, player_name, delivery_type, payment_file_id, status, user_inputs)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', $11)
            RETURNING id`,
            [
                userId,
                    ctx.from.username || null,
                state.product.type === "database" ? state.product.id : null,
                state.product.type === "ragner" ? state.product.id : null,
                state.product.name,
                state.product.price,
                extractedPlayerId,      // Use extracted player_id
                extractedPlayerName,    // Use extracted player_name
                state.product.type === "ragner" ? "ragner" : "manual",
                fileId,
                JSON.stringify(userInputs)
            ]
        );

        const orderId = result.rows[0].id;
        // Build user information string
        let userInfoText = "";
        if (state.collectedData) {
            if (state.collectedData.email) userInfoText += `Email: ${state.collectedData.email}\n`;
            if (state.collectedData.phone) userInfoText += `Phone: ${state.collectedData.phone}\n`;
            if (state.collectedData.password) userInfoText += `Password: ${state.collectedData.password}\n`;
            if (state.collectedData.username) userInfoText += `Username: ${state.collectedData.username}\n`;
            if (state.collectedData.player_id) userInfoText += `Player ID: ${state.collectedData.player_id}\n`;
        }
        
        if (state.playerId && !state.collectedData?.player_id) {
            userInfoText += `Player ID: ${state.playerId}\n`;
            userInfoText += `Player Name: ${state.playerName || "N/A"}\n`;
        }

        // Build caption WITHOUT Markdown to avoid parsing errors
        let caption = `📥 NEW PAYMENT RECEIVED\n\n`;
        caption += `👤 User: ${username}\n`;
        caption += `📦 Product: ${state.product.name}\n`;
        caption += `💰 Amount: ${state.product.price} ETB\n`;
        caption += `📦 Type: ${state.product.product_type || state.product.type}\n`;
        caption += `🧾 Order ID: #${orderId}\n`;
        
        if (userInfoText) {
            caption += `\n📋 USER INFORMATION:\n${userInfoText}`;
        }
        
        caption += `\n💳 Payment Method: ${state.paymentMethod?.name || "N/A"}\n\n`;
        caption += `Use buttons below to manage:`;

        await ctx.telegram.sendPhoto(
            process.env.ADMIN_ID,
            fileId,
            {
                caption: caption,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "✅ Approve", callback_data: `approve_${orderId}` },
                            { text: "❌ Reject", callback_data: `reject_${orderId}` }
                        ],
                        [
                            { text: "🎮 Complete", callback_data: `complete_${orderId}` }
                        ]
                    ]
                }
            }
        );

        await ctx.reply("✅ Payment received! Our team will process your order shortly.\n\nYou will receive a notification once completed.");
        delete userState[userId];

    } catch (error) {
        console.error("Payment screenshot error:", error);
        await ctx.reply("❌ Error processing payment. Please try again or contact support.");
    }
});

module.exports = bot;