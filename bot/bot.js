require("dotenv").config();
const { Telegraf } = require("telegraf");
const db = require("../database/db");
const bot = new Telegraf(process.env.BOT_TOKEN);
const axios = require("axios");
const { createOrder, validatePlayer, validatePlayerOnly } = require("../services/ragner");
const FormData = require("form-data");

const userState = {};
const processingOrders = new Set();
const userHistory = {};

// =====================
// 🟢 HELPER: PARSE USER INPUTS (safe for JSONB)
// =====================
function parseUserInputs(input) {
    if (!input) return null;
    if (typeof input === 'string') {
        try {
            return JSON.parse(input);
        } catch (e) {
            return null;
        }
    }
    return input;
}

function getTxIdHint(methodName) {
    const name = methodName?.toString().trim().toLowerCase() || "";
    if (name.includes("telebirr")) {
        return "📱 After payment, Telebirr will send you an SMS. Copy the transaction ID (e.g., FT26062K7WMY) from that message.";
    } else if (name.includes("cbe")) {
        return "🏦 After payment, CBE Birr will show a transaction reference. Copy the FT number from the receipt or SMS.";
    } else if (name.includes("abyssinia") || name.includes("boa")) {
        return "🏦 After payment, Bank of Abyssinia will give you a receipt with transaction ID. Copy the FT reference.";
    } else if (name.includes("ebirr")) {
        return "📱 After payment, eBirr will show a transaction ID. Copy it from the app or SMS.";
    } else {
        return "📝 After payment, copy the transaction ID / reference number from your bank app or SMS.";
    }
}

function resolveShegerPayProvider(methodName) {
    const name = methodName?.toString().trim().toLowerCase() || "";
    if (!name) return null;
    if (name.includes("telebirr") || name.includes("tele-birr") || name.includes("tele birr")) return "telebirr";
    if (name.includes("cbe")) return "cbe";
    if (name.includes("awash")) return "awash";
    if (name.includes("dashen")) return "dashen";
    if (name.includes("abyssinia") || name.includes("boa")) return "boa";
    if (name.includes("ebirr") || name.includes("e-birr")) return "ebirr_kaafi";
    if (name.includes("mpesa") || name.includes("m-pesa")) return "mpesa";
    return null;
}

// =====================
// 🟢 HELPER: PARSE SHEGERPAY TIMESTAMP
// =====================
function parseShegerTimestamp(timestampStr) {
    const [day, month, year, hour, minute, second] = timestampStr.split(/[- :]/);
    return new Date(year, month - 1, day, hour, minute, second);
}

// =====================
// 🟢 SHEGERPAY VERIFICATION (with transaction ID)
// =====================
async function verifyPaymentWithTxId(provider, transactionId, expectedAmount, merchantName = "Natan Top Up", expectedRecipientAccount = null, senderAccount = null) {
    if (process.env.SHEGERPAY_ENABLED !== "true") {
        return { verified: false, error: "ShegerPay disabled" };
    }
    const apiKey = process.env.SHEGERPAY_API_KEY;
    if (!apiKey) return { verified: false, error: "API key missing" };

    const maxRetries = 1;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const normalizedProvider = provider?.toString().trim().toLowerCase();
            if (!normalizedProvider) {
                return { verified: false, error: "Payment provider could not be determined" };
            }

            const requestBody = {
                provider: normalizedProvider,
                transaction_id: transactionId,
                amount: expectedAmount,
                merchant_name: merchantName,
            };

            // Add sender_account for BOA
            if (senderAccount && normalizedProvider === "boa") {
                requestBody.sender_account = senderAccount;
            }

            const response = await axios.post(
                "https://api.shegerpay.com/api/v1/verify",
                requestBody,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-API-Key": apiKey,
                    },
                    timeout: 30000,
                }
            );
            const data = response.data;
            console.log("ShegerPay response:", JSON.stringify(data, null, 2));

            const verified = data.verified === true || data.valid === true;
            if (!verified) {
                return { verified: false, error: data.message || data.detail?.message || "Verification failed", details: data };
            }

            let paidAmount = data.settled_amount != null ? parseFloat(data.settled_amount) : parseFloat(data.amount);
            if (isNaN(paidAmount)) {
                return { verified: false, error: "Could not retrieve transaction amount", details: data };
            }
            if (paidAmount < expectedAmount - 0.01) {
                return { verified: false, error: `Amount too low: expected at least ${expectedAmount} ETB, got ${paidAmount} ETB`, details: data };
            }
            if (paidAmount > expectedAmount + 10) {
                return { verified: false, error: `Amount too high: expected around ${expectedAmount} ETB, got ${paidAmount} ETB (max +10 ETB allowed)`, details: data };
            }

            if (data.timestamp) {
                const txTime = parseShegerTimestamp(data.timestamp);
                const now = new Date();
                const diffMinutes = (now - txTime) / (1000 * 60);
                if (diffMinutes > 30) {
                    return { verified: false, error: `Transaction is too old (${Math.round(diffMinutes)} minutes). Please use a recent payment.`, details: data };
                }
            }

            if (expectedRecipientAccount) {
                const fullMerchantAccount = String(expectedRecipientAccount).replace(/\s/g, "");
                const maskedAccount = data.credited_party_account;
                if (maskedAccount) {
                    const merchantLast4 = fullMerchantAccount.slice(-4);
                    const maskedLast4 = maskedAccount.slice(-4);
                    if (merchantLast4 !== maskedLast4) {
                        return { verified: false, error: `Payment was sent to account ending with ${maskedLast4}, but our account ends with ${merchantLast4}. Please check the account number.`, details: data };
                    }
                }
            }

            return { verified: true, data };
        } catch (err) {
            console.error(`ShegerPay verification attempt ${attempt + 1} failed:`, err.message);
            if (err.response) {
                console.error("Status:", err.response.status);
                console.error("Data:", err.response.data);
            }
            if (attempt === maxRetries) {
                return { verified: false, error: err.response?.data?.detail?.message || err.message };
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// =====================
// 🟢 PRICE ROUNDING FUNCTION
// =====================
function roundPrice(price) {
    const rounded = Math.round(price / 5) * 5;
    return Math.max(rounded, 5);
}

// =====================
// 🟢 Extract Sender Account from OCR Text (for BOA)
// =====================
function extractSenderAccount(fullText) {
    if (!fullText) return null;
    
    const patterns = [
        /Source\s*Account[:\s]*(\d{4,}\*{0,4}\d{0,4})/i,
        /Sender\s*Account[:\s]*(\d{4,}\*{0,4}\d{0,4})/i,
        /Payer\s*Account[:\s]*(\d{4,}\*{0,4}\d{0,4})/i,
        /From\s*(?:Account)?[:\s]*(\d{4,}\*{0,4}\d{0,4})/i,
        /(\d{1,2}\*{3,5}\d{3,5})/,
    ];
    
    for (const pattern of patterns) {
        const match = fullText.match(pattern);
        if (match && match[1]) {
            const account = match[1].replace(/\s/g, '');
            console.log("✅ Found sender account:", account);
            return account;
        }
    }
    
    return null;
}

// =====================
// 🟢 GOOGLE CLOUD VISION OCR - Extract Transaction ID from Image (FINAL)
// =====================
async function extractTxIdFromImage(imageFileId) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error("Google API key not configured");
        return { txId: null, fullText: "" };
    }

    try {
        const fileInfo = await bot.telegram.getFile(imageFileId);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;
        
        const imageResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const base64Image = Buffer.from(imageResponse.data).toString('base64');
        
        const response = await axios.post(
            `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
            {
                requests: [{
                    image: { content: base64Image },
                    features: [{ type: "TEXT_DETECTION", maxResults: 1 }]
                }]
            },
            {
                headers: { "Content-Type": "application/json" },
                timeout: 15000
            }
        );
        
        const textAnnotations = response.data?.responses?.[0]?.textAnnotations;
        
        if (!textAnnotations || textAnnotations.length === 0) {
            console.log("❌ No text found in image");
            return { txId: null, fullText: "" };
        }
        
        const fullText = textAnnotations[0]?.description || "";
        console.log("📝 Full detected text:");
        console.log(fullText);
        console.log("--- END OF TEXT ---");
        
        const skipWords = [
            'successful', 'download', 'share', 'transfer', 'money', 'prizes',
            'million', 'etb', 'birr', 'transaction', 'time', 'type', 'number',
            'abou', 'ama', 'manuel', 'hailu', 'batru', 'finished', 'play',
            'tele', 'code', 'plav', 'am', 'pm', 'qrcode', 'qr'
        ];
        
        let txId = null;
        
        // Strategy 1: Look for labeled transaction IDs
        console.log("🔍 Strategy 1: Looking for labeled TX IDs...");
        const labelPatterns = [
            /Transaction\s*Reference[:\s]*(FT\s*[A-Za-z0-9]{6,30})/i,
            /Reference[:\s]*(FT\s*[A-Za-z0-9]{6,30})/i,
            /Transaction\s*(?:No|Number|ID|#)[:\s]*([A-Za-z0-9]{6,30})/i,
            /Reference\s*(?:No|Number|ID)?[:\s]*([A-Za-z0-9]{6,30})/i,
            /Receipt\s*(?:No|Number)?[:\s]*([A-Za-z0-9]{6,30})/i,
            /FT[:\s#]*([A-Za-z0-9]{6,30})/i,
            /Trx\s*(?:No|ID|Number)?[:\s]*([A-Za-z0-9]{6,30})/i,
        ];
        
        for (const pattern of labelPatterns) {
            const match = fullText.match(pattern);
            if (match && match[1]) {
                const candidate = match[1].replace(/\s/g, '').trim();
                if (!skipWords.includes(candidate.toLowerCase()) && candidate.length >= 6) {
                    txId = candidate;
                    console.log("✅ Found TX ID via label:", txId);
                    break;
                }
            }
        }
        
        // Strategy 2: Look for lines containing transaction keywords
        if (!txId) {
            console.log("🔍 Strategy 2: Looking for transaction lines...");
            const lines = fullText.split('\n');
            for (const line of lines) {
                const lowerLine = line.toLowerCase();
                if (lowerLine.includes('transaction') || lowerLine.includes('reference') || 
                    lowerLine.includes('receipt') || lowerLine.includes('ft') ||
                    lowerLine.includes('trx') || lowerLine.includes('txn')) {
                    
                    console.log("📄 Examining line:", line);
                    
                    const codeMatch = line.match(/([A-Za-z0-9]{8,30})/);
                    if (codeMatch && !skipWords.includes(codeMatch[1].toLowerCase())) {
                        txId = codeMatch[1];
                        console.log("✅ Found TX ID in transaction line:", txId);
                        break;
                    }
                }
            }
        }
        
        // Strategy 2.5: Look for the NEXT line after a transaction label
        if (!txId) {
            console.log("🔍 Strategy 2.5: Looking for ID on line after transaction label...");
            const lines = fullText.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const lowerLine = lines[i].toLowerCase().trim();
                if (lowerLine.includes('transaction number') || 
                    lowerLine.includes('transaction id') ||
                    lowerLine.includes('transaction reference') ||
                    lowerLine.includes('receipt') ||
                    lowerLine.includes('Lakkoofsa sochii') ||
                    lowerLine.includes('Within BOA') ||
                    lowerLine.includes('transaction to')) {
                    
                    console.log("📄 Found label line:", lines[i].trim());
                    
                    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                        const line = lines[j].trim();
                        if (line && !skipWords.some(w => line.toLowerCase().includes(w))) {
                            console.log("   Checking line", j + ":", line);
                            const codeMatch = line.match(/([A-Z0-9]{2,4}\s*\d{2,4}[A-Z0-9]{2,8}|[A-Z0-9]{8,20})/i);
                            if (codeMatch) {
                                const candidate = codeMatch[1].replace(/\s/g, '').trim();
                                if (candidate.length >= 8 && /[A-Za-z]/.test(candidate) && /\d/.test(candidate)) {
                                    txId = candidate;
                                    console.log("✅ Found TX ID on line after label:", txId, "(line index:", j, ")");
                                    break;
                                }
                            }
                        }
                    }
                    if (txId) break;
                }
            }
        }
        
        // Strategy 3: Pattern matching for IDs with mixed letters and numbers
        if (!txId) {
            console.log("🔍 Strategy 3: Pattern matching...");
            const items = fullText.split(/[\n\s]+/);
            
            for (const item of items) {
                const cleaned = item.trim();
                if (cleaned.length < 8 || cleaned.length > 25) continue;
                if (skipWords.some(w => cleaned.toLowerCase() === w)) continue;
                if (/^\d{4}\/\d{2}\/\d{2}$/.test(cleaned)) continue;
                if (/^\d{2}:\d{2}(:\d{2})?$/.test(cleaned)) continue;
                if (/%$/.test(cleaned)) continue;
                if (/ETB/i.test(cleaned) || /^[-]?\d+\.\d{2}$/.test(cleaned)) continue;
                if (/^251\d+$/.test(cleaned) || /^09\d+$/.test(cleaned) || /^\d{10,}$/.test(cleaned)) continue;
                if (/\/s$/i.test(cleaned)) continue;
                
                if (/[A-Za-z]/.test(cleaned) && /\d/.test(cleaned) && cleaned.length >= 8) {
                    txId = cleaned;
                    console.log("✅ Found TX ID via mixed alphanumeric:", txId);
                    break;
                }
            }
        }
        
        // Strategy 4: Last resort
        if (!txId) {
            console.log("🔍 Strategy 4: Last resort search...");
            const matches = fullText.match(/\b([A-Z]{2,4}[0-9]{4,}[A-Z0-9]{0,8})\b/g);
            if (matches) {
                for (const match of matches) {
                    const candidate = match.trim();
                    if (candidate.length >= 8 && !skipWords.includes(candidate.toLowerCase())) {
                        txId = candidate;
                        console.log("✅ Found TX ID via last resort:", txId);
                        break;
                    }
                }
            }
        }
        
        if (!txId) {
            console.log("❌ Could not identify transaction ID in text");
            return { txId: null, fullText };
        }
        
        // Final cleanup
        txId = txId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 40);
        
        // Check if "FT" prefix is nearby (for BOA)
        if (!txId.toUpperCase().startsWith('FT') && fullText) {
            const escapedTxId = txId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const ftPattern = new RegExp(`FT\\s*${escapedTxId}`, 'i');
            if (ftPattern.test(fullText)) {
                txId = 'FT' + txId;
                console.log("✅ Added FT prefix to TX ID:", txId);
            }
            const lines = fullText.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(txId) && i > 0 && lines[i-1].toUpperCase().includes('FT')) {
                    txId = 'FT' + txId;
                    console.log("✅ Added FT prefix from previous line:", txId);
                    break;
                }
            }
        }
        
        console.log("🧹 Final TX ID:", txId);
        
        return { txId, fullText };
        
    } catch (error) {
        console.error("❌ Cloud Vision API error:", error.response?.data || error.message);
        return { txId: null, fullText: "" };
    }
}

// =====================
// 🟢 WALLET FUNCTIONS
// =====================
async function getWalletBalance(telegramId) {
    try {
        let wallet = await db.query(
            "SELECT balance FROM user_wallets WHERE telegram_id = $1",
            [telegramId]
        );
        if (wallet.rows.length === 0) {
            await db.query(
                "INSERT INTO user_wallets (telegram_id, balance) VALUES ($1, 0)",
                [telegramId]
            );
            return 0;
        }
        return parseFloat(wallet.rows[0].balance);
    } catch (error) {
        console.error("Get wallet error:", error);
        return 0;
    }
}

async function updateWalletBalance(telegramId, amount, type, referenceId, description) {
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            throw new Error(`Invalid amount: ${amount}`);
        }
        const currentBalance = await getWalletBalance(telegramId);
        const newBalance = type === "DEPOSIT" ? currentBalance + numericAmount : currentBalance - numericAmount;
        await client.query(
            "UPDATE user_wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = $2",
            [newBalance, telegramId]
        );
        await client.query(
            `INSERT INTO transaction_history 
            (telegram_id, type, amount, balance_before, balance_after, reference_id, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [telegramId, type, numericAmount, currentBalance, newBalance, referenceId, description]
        );
        await client.query("COMMIT");
        return newBalance;
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Update wallet error:", error);
        throw error;
    } finally {
        client.release();
    }
}

async function getDepositAmounts() {
    try {
        const result = await db.query("SELECT value FROM settings WHERE key='deposit_amounts'");
        if (result.rows[0]?.value) {
            return JSON.parse(result.rows[0].value);
        }
        return [50, 100, 200, 400, 500, 1000, 2000, 4000];
    } catch (error) {
        console.error("Deposit amounts error:", error);
        return [50, 100, 200, 400, 500, 1000, 2000, 4000];
    }
}

// =====================
// 🟢 GET PROFIT MARGIN
// =====================
async function getProfitMargin(usdPrice) {
    try {
        const result = await db.query("SELECT value FROM settings WHERE key='profit_margins'");
        if (result.rows[0]?.value) {
            const margins = JSON.parse(result.rows[0].value);
            const range = margins.ranges.find((r) => usdPrice >= r.min_usd && usdPrice <= r.max_usd);
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
// 🟢 BUILD ORDER DETAILS (safe parsing)
// =====================
function buildOrderDetails(order) {
    let details = `📦 ORDER #${order.id}\n`;
    details += `━━━━━━━━━━━━━━━━━━━━\n`;
    if (order.telegram_username) {
        details += `👤 User: @${order.telegram_username}\n`;
    } else {
        details += `👤 User ID: ${order.telegram_id}\n`;
    }
    details += `📦 Product: ${order.product_name}\n`;
    details += `💰 Amount: ${order.price_etb} ETB\n`;
    details += `📅 Date: ${new Date(order.created_at).toLocaleString()}\n`;
    if (order.player_id) {
        details += `\n🎮 Player ID: ${order.player_id}\n`;
    }
    if (order.player_name) {
        details += `👤 Player Name: ${order.player_name}\n`;
    }
    if (order.user_inputs) {
        const inputs = parseUserInputs(order.user_inputs);
        if (inputs) {
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
            if (hasInputs) {
                details += inputsText;
            }
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
// 🟢 SAFE EDIT MESSAGE
// =====================
async function safeEdit(ctx, text, buttons) {
    try {
        if (ctx.callbackQuery && ctx.callbackQuery.message) {
            if (ctx.callbackQuery.message.photo) {
                return ctx.editMessageCaption(text, {
                    parse_mode: "HTML",
                    reply_markup: { inline_keyboard: buttons },
                });
            } else {
                return ctx.editMessageText(text, {
                    parse_mode: "HTML",
                    reply_markup: { inline_keyboard: buttons },
                });
            }
        } else {
            return ctx.reply(text, {
                parse_mode: "HTML",
                reply_markup: { inline_keyboard: buttons },
            });
        }
    } catch (error) {
        console.error("SafeEdit error:", error.message);
        try {
            return ctx.reply(text.replace(/<[^>]*>/g, ''), {
                reply_markup: { inline_keyboard: buttons },
            });
        } catch (e2) {
            console.error("SafeEdit fallback error:", e2.message);
        }
    }
}

// =====================
// 🟢 SAFE EDIT MEDIA
// =====================
async function safeEditMedia(ctx, imageUrl, caption, buttons) {
    try {
        if (ctx.callbackQuery && ctx.callbackQuery.message) {
            await ctx.editMessageMedia(
                {
                    type: "photo",
                    media: imageUrl,
                    caption: caption,
                    parse_mode: "HTML",
                },
                {
                    reply_markup: { inline_keyboard: buttons },
                }
            );
        } else {
            await ctx.replyWithPhoto(imageUrl, {
                caption: caption,
                parse_mode: "HTML",
                reply_markup: { inline_keyboard: buttons },
            });
        }
    } catch (error) {
        console.error("SafeEditMedia error:", error.message);
        await ctx.replyWithPhoto(imageUrl, {
            caption: caption,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: buttons },
        });
    }
}

// =====================
// 🟢 BUTTON BUILDER - ALWAYS VERTICAL
// =====================
function buildButtons(items, singleColumn = true) {
    const rows = [];
    for (let i = 0; i < items.length; i++) {
        rows.push([items[i]]);
    }
    return rows;
}

// =====================
// 🟢 BUILD BUTTONS HORIZONTAL (for main menu only)
// =====================
function buildButtonsHorizontal(items) {
    const rows = [];
    for (let i = 0; i < items.length; i += 2) {
        rows.push(items.slice(i, i + 2));
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
// 🟢 NAVIGATION HELPERS
// =====================
function pushHistory(userId, screen, data = null) {
    if (!userHistory[userId]) userHistory[userId] = [];
    userHistory[userId].push({ screen, data });
}
function popHistory(userId) {
    if (userHistory[userId] && userHistory[userId].length > 0) userHistory[userId].pop();
}
function getPreviousScreen(userId) {
    if (userHistory[userId] && userHistory[userId].length > 0) return userHistory[userId][userHistory[userId].length - 1];
    return null;
}
function clearHistory(userId) {
    delete userHistory[userId];
}

// =====================
// 🟢 SHOW RAGNER PRODUCTS (UC up to 3850)
// =====================
async function showRagnerProducts(ctx) {
    try {
        const res = await axios.get(
            "https://ragnergiftcard.com/api/v1/products?game=PUBG",
            { headers: { "X-API-KEY": process.env.RAGNER_API_KEY }, timeout: 10000 }
        );
        const rate = await getExchangeRate();
        const products = res.data.data.filter((p) => {
            const name = p.name.toLowerCase();
            const ucMatch = p.name.match(/\d+/);
            const uc = ucMatch ? parseInt(ucMatch[0]) : 0;
            const excludeKeywords = ["card", "web", "prime", "plus", "weekly", "deal", "pack", "bundle", "chest", "crate"];
            const isExcluded = excludeKeywords.some((kw) => name.includes(kw));
            return !isExcluded && uc >= 60 && uc <= 3850;
        });
        products.sort((a, b) => {
            const ucA = parseInt(a.name.match(/\d+/) || 0);
            const ucB = parseInt(b.name.match(/\d+/) || 0);
            return ucA - ucB;
        });
        if (products.length === 0) {
            await safeEdit(ctx, "📭 No instant products available.", [[{ text: "🔙 Back", callback_data: "back" }]]);
            return;
        }
        const productButtons = [];
        for (const p of products) {
            const margin = await getProfitMargin(p.price);
            const priceWithMargin = p.price * (1 + margin / 100);
            let priceETB = Math.round(priceWithMargin * rate);
            priceETB = roundPrice(priceETB);
            productButtons.push({
                text: `${p.name} - ${priceETB} ETB`,
                callback_data: `ragner_${p.id}_${priceETB}_${p.name.replace(/ /g, "_")}`,
            });
        }
        const buttons = buildButtons(productButtons);
        buttons.push([{ text: "🔙 Back", callback_data: "back" }]);
        buttons.push([{ text: "🏠 Main Menu", callback_data: "main_menu" }]);
        await safeEdit(ctx, "⚡ PUBG UC Instant Delivery\n\nMax: 3850 UC\n\nSelect UC amount:", buttons);
    } catch (error) {
        console.error("Ragner products error:", error);
        await safeEdit(ctx, "⏳ Service busy. Please try again.", [[{ text: "🔙 Back", callback_data: "back" }]]);
    }
}

// =====================
// 🟢 SHOW DATABASE PRODUCTS
// =====================
async function showDatabaseProducts(ctx, subId) {
    try {
        const subResult = await db.query("SELECT * FROM subcategories WHERE id = $1", [subId]);
        const subcategory = subResult.rows[0];
        
        const result = await db.query(
            `SELECT * FROM products WHERE subcategory_id = $1 AND is_active = true ORDER BY position ASC, id ASC`,
            [subId]
        );
        if (result.rows.length === 0) {
            await safeEdit(ctx, "📭 No products available right now.", [
                [{ text: "🔙 Back", callback_data: "back" }],
                [{ text: "❌ Cancel Order", callback_data: "cancel_order" }]
            ]);
            return;
        }
        const productType = result.rows[0]?.product_type;
        const buttons = buildButtons(
            result.rows.map((p) => ({
                text: `${p.name} - ${p.price_etb} ETB`,
                callback_data: `db_${p.id}_${p.price_etb}_${p.product_type}_${p.name.replace(/ /g, "_")}`,
            })),
            true
        );
        buttons.push([{ text: "🔙 Back", callback_data: "back" }]);
        buttons.push([{ text: "❌ Cancel Order", callback_data: "cancel_order" }]);
        buttons.push([{ text: "🏠 Main Menu", callback_data: "main_menu" }]);
        
        let title = "📦 Select Product:";
        if (productType === "grospack") title = "🎁 Grospack Options:";
        if (productType === "subscription") title = "👑 Subscription Plans:";
        if (productType === "free_fire") title = "🔥 Free Fire Diamonds:";
        if (productType === "tiktok") title = "📱 TikTok Coins:";
        if (productType === "uc_manual") title = "📦 PUBG UC Manual:";
        
        let displayImage = subcategory?.image_url;
        if (!displayImage && subcategory?.category_id) {
            const catResult = await db.query("SELECT image_url FROM categories WHERE id = $1", [subcategory.category_id]);
            displayImage = catResult.rows[0]?.image_url || "https://assets-prd.ignimgs.com/2025/07/16/25-best-ps5-games-blogroll-1752704467824.jpg";
        }
        
        await safeEditMedia(ctx, displayImage, title, buttons);
        
    } catch (error) {
        console.error("Database products error:", error);
        await safeEdit(ctx, "⚠️ Error loading products.", [[{ text: "🔙 Back", callback_data: "back" }]]);
    }
}

// =====================
// 🟢 SHOW CATEGORIES
// =====================
async function showCategories(ctx) {
    try {
        const categories = await db.query(
            "SELECT * FROM categories WHERE is_active=true AND name NOT IN ('channel', 'information', 'info') ORDER BY position"
        );
        const buttons = buildButtonsHorizontal(
            categories.rows.map((c) => ({ 
                text: `${c.icon || "📂"} ${c.display_name}`, 
                callback_data: `cat_${c.id}` 
            }))
        );
        buttons.push([
            { text: "📋 My Orders", callback_data: "myorders_back" },
            { text: "👛 My Wallet", callback_data: "show_wallet" },
        ]);
        buttons.push([
            { text: "🎟️ Get Ticket", callback_data: "giveaway_ticket" },
        ]);
        buttons.push([
            { text: "📞 Support", callback_data: "support_menu" },
            { text: "📢 Our Channel", url: `https://t.me/${process.env.CHANNEL_USERNAME?.replace("@", "") || "natan_topup"}` },
        ]);
        buttons.push([
            { text: "ℹ️ Info", callback_data: "info_menu" },
            { text: "❓ Help", callback_data: "help_menu" },
        ]);
        buttons.push([{ text: "🏠 Main Menu", callback_data: "main_menu" }]);
        await safeEdit(ctx, "📂 Select Category:", buttons);
    } catch (error) {
        console.error("Show categories error:", error);
        await safeEdit(ctx, "⚠️ Error loading categories.", []);
    }
}

// =====================
// 🟢 SHOW WALLET
// =====================
async function showWallet(ctx) {
    const userId = ctx.from.id;
    const balance = await getWalletBalance(userId);
    const buttons = [
        [{ text: "💰 Deposit", callback_data: "wallet_deposit" }],
        [{ text: "📜 Transaction History", callback_data: "wallet_history" }],
        [{ text: "🔙 Back", callback_data: "back" }],
        [{ text: "🏠 Main Menu", callback_data: "main_menu" }],
    ];
    const emojiText = "👛 MY WALLET";
    await safeEdit(ctx, `${emojiText}\n\n💰 Balance: ${balance} ETB\n\nSelect an option below:`, buttons);
}

// =====================
// 🟢 SHOW DEPOSIT AMOUNTS
// =====================
async function showDepositAmounts(ctx) {
    const amounts = await getDepositAmounts();
    const buttons = buildButtons(amounts.map((a) => ({ text: `${a} ETB`, callback_data: `deposit_${a}` })));
    buttons.push([{ text: "🔙 Back", callback_data: "back" }]);
    buttons.push([{ text: "🏠 Main Menu", callback_data: "main_menu" }]);
    await safeEdit(ctx, "💰 Select Deposit Amount:", buttons);
}

// 🟢 SHOW DEPOSIT PAYMENT METHODS
async function showDepositPaymentMethods(ctx, amount) {
    const methods = await getPaymentMethods();
    if (methods.length === 0) {
        await safeEdit(ctx, "⚠️ Payment methods not configured. Please contact support.", []);
        return;
    }
    const userId = ctx.from.id;
    if (!userState[userId]) userState[userId] = {};
    userState[userId].depositAmount = amount;
    const buttons = methods.map((m) => [{ text: m.name, callback_data: `deposit_paymethod_${m.id}_${amount}` }]);
    buttons.push([{ text: "🔙 Back", callback_data: "back" }]);
    buttons.push([{ text: "🏠 Main Menu", callback_data: "main_menu" }]);
    await safeEdit(ctx, `💰 Deposit ${amount} ETB\n\nSelect payment method:`, buttons);
}

// =====================
// 🟢 SHOW TRANSACTION HISTORY
// =====================
async function showTransactionHistory(ctx) {
    const userId = ctx.from.id;
    try {
        const history = await db.query(
            `SELECT * FROM transaction_history WHERE telegram_id = $1 ORDER BY created_at DESC LIMIT 20`,
            [userId]
        );
        if (history.rows.length === 0) {
            await safeEdit(ctx, "📜 No transactions found.", [[{ text: "🔙 Back", callback_data: "back" }]]);
            return;
        }
        let message = "📜 TRANSACTION HISTORY\n\n";
        for (const t of history.rows) {
            const emoji = t.type === "DEPOSIT" ? "➕" : "➖";
            const date = new Date(t.created_at).toLocaleDateString();
            message += `${emoji} ${t.type}: ${t.amount} ETB\n   📅 ${date}\n   📝 ${t.description || "-"}\n\n`;
        }
        message += `\nShowing last 20 transactions`;
        await safeEdit(ctx, message, [[{ text: "🔙 Back", callback_data: "back" }]]);
    } catch (error) {
        console.error("Transaction history error:", error);
        await safeEdit(ctx, "⚠️ Error loading history.", [[{ text: "🔙 Back", callback_data: "back" }]]);
    }
}

// =====================
// 🟢 SHOW WARNING MESSAGE (TikTok)
// =====================
async function showWarningMessage(ctx, product) {
    const warning = product.warning_message ||
        "⚠️ IMPORTANT SECURITY NOTICE\n\n" +
        "• Please turn off 2-step verification before sharing\n" +
        "• Your credentials are safe and secure\n" +
        "• We will only access your account to add coins\n" +
        "• Change your password after delivery for extra security\n\n" +
        "Do you understand and wish to continue?";
    const buttons = [
        [{ text: "✅ I Understand, Continue", callback_data: `continue_${product.id}` }],
        [{ text: "❌ Cancel", callback_data: "cancel_order" }],
    ];
    await ctx.reply(warning, { parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
}

// =====================
// 🟢 ASK FOR FIELDS (Player ID, Email, etc.) - WITH PLAYER VALIDATION FOR ALL PUBG
// =====================
async function askForFields(ctx, product) {
    const state = userState[ctx.from.id];
    const productType = product.product_type;
    
    const pubgTypes = ["free_fire", "uc_manual", "grospack", "subscription", "uc_instant"];
    
    if (pubgTypes.includes(productType)) {
        state.requiredFields = ["player_id"];
    } else if (productType === "tiktok") {
        state.requiredFields = ["email", "phone", "password"];
    } else if (productType === "telegram") {
        state.requiredFields = ["username", "phone"];
    } else {
        state.requiredFields = ["player_id"];
    }
    
    state.currentField = 0;
    state.collectedData = {};
    state.step = "PLAYER";
    
    state.product = {
        productId: product.id,
        price: product.price_etb,
        name: product.name,
        type: product.product_type === "uc_instant" ? "ragner" : "database",
        product_type: productType,
        fullProduct: product
    };
    
    const firstField = state.requiredFields[0];
    const prompts = {
        email: "📧 Enter TikTok Email:\n\nType /cancel to cancel",
        phone: "📱 Enter Phone Number:\n\nType /cancel to cancel",
        password: "🔐 Enter Password:\n\n⚠️ Your credentials are safe and secure\nType /cancel to cancel",
        username: "👤 Enter Telegram Username:\n\nExample: @username\nType /cancel to cancel",
        player_id: "🎮 Enter Player ID:\n\nExample: 51807260252\nType /cancel to cancel",
    };
    await ctx.reply(prompts[firstField] || `Enter ${firstField}:`);
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
            email: "📧 Enter TikTok Email:\n\nType /cancel to cancel",
            phone: "📱 Enter Phone Number:\n\nType /cancel to cancel",
            password: "🔐 Enter Password:\n\n⚠️ Your credentials are safe and secure\nType /cancel to cancel",
            username: "👤 Enter Telegram Username:\n\nExample: @username\nType /cancel to cancel",
            player_id: "🎮 Enter Player ID:\n\nExample: 51807260252\nType /cancel to cancel",
        };
        return ctx.reply(prompts[nextField] || `Enter ${nextField}:`);
    }
    let confirmMessage = "✅ Please confirm your information:\n\n";
    if (product.product_type === "tiktok") {
        confirmMessage += `📧 Email: ${state.collectedData.email}\n📱 Phone: ${state.collectedData.phone}\n🔐 Password: ${"•".repeat(state.collectedData.password.length)}\n\n`;
    } else if (product.product_type === "telegram") {
        confirmMessage += `👤 Username: ${state.collectedData.username}\n📱 Phone: ${state.collectedData.phone}\n\n`;
    } else {
        confirmMessage += `🆔 Player ID: ${state.collectedData.player_id}\n\n`;
    }
    confirmMessage += `Is this correct?`;
    state.step = "CONFIRM";
    await ctx.reply(confirmMessage, {
        parse_mode: "HTML",
        reply_markup: { 
            inline_keyboard: [
                [{ text: "✅ Yes", callback_data: "confirm_yes" }, { text: "❌ No", callback_data: "confirm_no" }],
                [{ text: "❌ Cancel Order", callback_data: "cancel_order" }]
            ] 
        },
    });
}

// =====================
// 🟢 SHOW PAYMENT OPTIONS (Wallet or Bank)
// =====================
async function showPaymentOptions(ctx, productInfo) {
    const balance = await getWalletBalance(ctx.from.id);
    const buttons = [
        [{ text: "👛 Pay from Wallet", callback_data: `pay_wallet_${productInfo.productId}_${productInfo.price}_${productInfo.name.replace(/ /g, "_")}` }],
        [{ text: "💳 Bank Transfer", callback_data: `pay_bank_${productInfo.productId}_${productInfo.price}_${productInfo.name.replace(/ /g, "_")}` }],
        [{ text: "❌ Cancel Order", callback_data: "cancel_order" }],
        [{ text: "🔙 Back", callback_data: "back" }],
        [{ text: "🏠 Main Menu", callback_data: "main_menu" }],
    ];
    await safeEdit(
        ctx,
        `💳 PAYMENT OPTIONS\n\n📦 Product: ${productInfo.name}\n💰 Amount: ${productInfo.price} ETB\n\n👛 Wallet Balance: ${balance} ETB\n\nSelect payment method:`,
        buttons
    );
}

// =====================
// 🟢 SHOW BANK TRANSFER METHODS
// =====================
async function showBankTransferMethods(ctx, productInfo) {
    const methods = await getPaymentMethods();
    if (methods.length === 0) {
        await safeEdit(ctx, "⚠️ Payment methods not configured. Please contact support.", []);
        return false;
    }
    const userId = ctx.from.id;
    if (!userState[userId]) userState[userId] = {};
    userState[userId].productInfo = productInfo;

    const buttons = methods.map((m) => [
        { text: m.name, callback_data: `payment_${m.id}_${productInfo.productId}_${productInfo.price}_${productInfo.name.replace(/ /g, "_")}` },
    ]);
    buttons.push([{ text: "❌ Cancel Order", callback_data: "cancel_order" }]);
    buttons.push([{ text: "🔙 Back", callback_data: "back" }]);
    buttons.push([{ text: "🏠 Main Menu", callback_data: "main_menu" }]);

    await safeEdit(ctx, "💳 SELECT PAYMENT METHOD:", buttons);
    return true;
}

// =====================
// 🟢 SHOW PAYMENT DETAILS
// =====================
async function showPaymentDetails(ctx, paymentMethod, productInfo) {
    const shortCaption = `
📦 Product: ${productInfo.name}
💰 Amount: ${productInfo.price} ETB

🏦 ${paymentMethod.name}
📞 Account: ${paymentMethod.account_number}
👤 Name: ${paymentMethod.account_name || "N/A"}

${paymentMethod.instructions || ""}

━━━━━━━━━━━━━━━━━━━━
⚠️ LEGAL WARNING:
By paying, you confirm you are 18+ and agree to our Terms.

🔹 INSTRUCTIONS:
1️⃣ Copy account & verify name.
2️⃣ Send EXACTLY ${productInfo.price} ETB only.
3️⃣ After payment, send the payment screenshot here.
4️⃣ We will verify automatically.

⏳ Order expires in 30 minutes.
Type /cancel to cancel.
    `;

    const userId = ctx.from.id;
    if (!userState[userId]) userState[userId] = {};
    userState[userId].paymentMethod = paymentMethod;
    userState[userId].productInfo = productInfo;
    userState[userId].step = "PAY";

    if (paymentMethod.image_url && paymentMethod.image_url.trim() !== "") {
        await ctx.replyWithPhoto(paymentMethod.image_url, { caption: shortCaption, parse_mode: "HTML" });
    } else {
        await ctx.reply(shortCaption, { parse_mode: "HTML" });
    }
}

// =====================
// 🟢 PROCESS WALLET PAYMENT
// =====================
async function processWalletPayment(ctx, productInfo) {
    const userId = ctx.from.id;
    const balance = await getWalletBalance(userId);
    if (balance < productInfo.price) {
        await safeEdit(
            ctx,
            `❌ INSUFFICIENT BALANCE\n\nRequired: ${productInfo.price} ETB\nYour Balance: ${balance} ETB\n\nPlease deposit more funds.`,
            [[{ text: "💰 Deposit Now", callback_data: "wallet_deposit" }, { text: "🔙 Back", callback_data: "back" }]]
        );
        return false;
    }
    const isInstant = productInfo.type === "ragner" || productInfo.product_type === "uc_instant";
    if (isInstant) {
        const orderRes = await db.query(
            `INSERT INTO orders 
            (telegram_id, telegram_username, product_name, price_etb, delivery_type, status, payment_method, external_product_id, player_id)
            VALUES ($1, $2, $3, $4, $5, 'PENDING', 'wallet', $6, $7)
            RETURNING id`,
            [userId, ctx.from.username || null, productInfo.name, productInfo.price, "ragner", productInfo.productId, productInfo.playerId]
        );
        const orderId = orderRes.rows[0].id;

        await updateWalletBalance(userId, productInfo.price, "PURCHASE", orderId, `Purchase: ${productInfo.name}`);

        const deliveryResult = await createOrder(productInfo.productId, productInfo.playerId);
        if (deliveryResult && deliveryResult.success) {
            await db.query(`UPDATE orders SET status='COMPLETED' WHERE id=$1`, [orderId]);
            await safeEdit(ctx, `✅ PAYMENT SUCCESSFUL!\n\n📦 ${productInfo.name}\n💰 ${productInfo.price} ETB deducted from wallet\n🎮 Order #${orderId} completed! UC delivered.`, []);
            await ctx.telegram.sendMessage(
                process.env.ADMIN_ID,
                `🟢 WALLET PURCHASE (AUTO-COMPLETED & DELIVERED)\n\n👤 User: @${ctx.from.username || userId}\n📦 Product: ${productInfo.name}\n💰 Amount: ${productInfo.price} ETB\n🧾 Order ID: #${orderId}\n✅ Auto-completed from wallet balance, UC delivered.`
            );
            setTimeout(() => showMainMenu(ctx), 2000);
        } else {
            await db.query(`UPDATE orders SET status='APPROVED' WHERE id=$1`, [orderId]);
            await safeEdit(ctx, `✅ PAYMENT RECEIVED!\n\n📦 ${productInfo.name}\n💰 ${productInfo.price} ETB deducted from wallet\n🔄 Order #${orderId} pending manual delivery.\n\nYou will be notified when completed.`, []);
            await ctx.telegram.sendMessage(
                process.env.ADMIN_ID,
                `🟡 WALLET PURCHASE (PENDING MANUAL DELIVERY)\n\n👤 User: @${ctx.from.username || userId}\n📦 Product: ${productInfo.name}\n💰 Amount: ${productInfo.price} ETB\n🧾 Order ID: #${orderId}\n⚠️ Auto-delivery failed. Please complete manually.`,
                { reply_markup: { inline_keyboard: [[{ text: "🎮 Complete Delivery", callback_data: `complete_${orderId}` }]] } }
            );
            setTimeout(() => showMainMenu(ctx), 3000);
        }
        return true;
    } else {
        const result = await db.query(
            `INSERT INTO orders 
            (telegram_id, telegram_username, product_name, price_etb, delivery_type, status, payment_method, player_id, player_name, user_inputs)
            VALUES ($1, $2, $3, $4, $5, 'PENDING', 'wallet', $6, $7, $8)
            RETURNING id`,
            [userId, ctx.from.username || null, productInfo.name, productInfo.price, "manual",
             productInfo.playerId || null, productInfo.playerName || null,
             JSON.stringify(productInfo.userInputs || {})]
        );
        const orderId = result.rows[0].id;
        await updateWalletBalance(userId, productInfo.price, "PURCHASE", orderId, `Purchase: ${productInfo.name} (Pending Approval)`);
        await safeEdit(ctx, `✅ PAYMENT RECEIVED!\n\n📦 ${productInfo.name}\n💰 ${productInfo.price} ETB deducted from wallet\n🔄 Order #${orderId} pending admin approval.\n\nYou will be notified when approved.`, []);
        
        let adminMessage = `🟡 WALLET PURCHASE (PENDING APPROVAL)\n\n━━━━━━━━━━━━━━━━━━━━\n👤 User: @${ctx.from.username || userId}\n📦 Product: ${productInfo.name}\n💰 Amount: ${productInfo.price} ETB\n🧾 Order ID: #${orderId}\n💳 Payment Method: Wallet Balance\n\n`;
        if (productInfo.playerId) adminMessage += `🎮 Player ID: ${productInfo.playerId}\n`;
        if (productInfo.playerName) adminMessage += `👤 Player Name: ${productInfo.playerName}\n`;
        if (productInfo.userInputs) {
            if (productInfo.userInputs.email) adminMessage += `📧 Email: ${productInfo.userInputs.email}\n`;
            if (productInfo.userInputs.phone) adminMessage += `📱 Phone: ${productInfo.userInputs.phone}\n`;
            if (productInfo.userInputs.password) adminMessage += `🔐 Password: ${productInfo.userInputs.password}\n`;
            if (productInfo.userInputs.username) adminMessage += `👤 Username: ${productInfo.userInputs.username}\n`;
            if (productInfo.userInputs.player_id) adminMessage += `🆔 Player ID: ${productInfo.userInputs.player_id}\n`;
        }
        adminMessage += `\n━━━━━━━━━━━━━━━━━━━━\n⚠️ Amount already deducted from wallet.\n👇 Click "Complete" after manual delivery.`;
        await ctx.telegram.sendMessage(process.env.ADMIN_ID, adminMessage, {
            reply_markup: { inline_keyboard: [[{ text: "✅ Complete", callback_data: `complete_${orderId}` }, { text: "❌ Reject", callback_data: `reject_${orderId}` }]] },
        });
        setTimeout(() => showMainMenu(ctx), 3000);
        return true;
    }
}

// =====================
// 🟢 SHOW MAIN MENU
// =====================
async function showMainMenu(ctx) {
    try {
        const categories = await db.query(
            "SELECT * FROM categories WHERE is_active=true AND name NOT IN ('channel', 'information', 'info') ORDER BY position"
        );
        const buttons = buildButtonsHorizontal(
            categories.rows.map((c) => ({ text: `${c.icon || "📂"} ${c.display_name}`, callback_data: `cat_${c.id}` }))
        );
        buttons.push([
            { text: "📋 My Orders", callback_data: "myorders_back" },
            { text: "👛 My Wallet", callback_data: "show_wallet" },
        ]);
        buttons.push([
            { text: "🎟️ Get Ticket", callback_data: "giveaway_ticket" },
        ]);
        buttons.push([
            { text: "📞 Support", callback_data: "support_menu" },
            { text: "📢 Our Channel", url: `https://t.me/${process.env.CHANNEL_USERNAME?.replace("@", "") || "natan_topup"}` },
        ]);
        buttons.push([
            { text: "ℹ️ Info", callback_data: "info_menu" },
            { text: "❓ Help", callback_data: "help_menu" },
        ]);
        const mainMenuBanner = await getMainMenuBanner();
        const caption = `🎮 Natan Top Up\n\n⚡ Fast • Secure • Reliable\n\nSelect a service below 👇`;
        
        if (ctx.callbackQuery && ctx.callbackQuery.message) {
            await safeEditMedia(ctx, mainMenuBanner, caption, buttons);
        } else {
            await ctx.replyWithPhoto(mainMenuBanner, { 
                caption: caption, 
                parse_mode: "HTML", 
                reply_markup: { inline_keyboard: buttons } 
            });
        }
    } catch (error) {
        console.error("Show main menu error:", error);
        await ctx.reply("⚠️ System error. Please try /start again.");
    }
}

// =====================
// 🟢 GIVEAWAY HELPERS
// =====================
async function getCurrentRoundId() {
    const result = await db.query(
        "SELECT id FROM giveaway_rounds WHERE status = 'active' ORDER BY id DESC LIMIT 1"
    );
    return result.rows.length ? result.rows[0].id : null;
}

function generateTicketNumber() {
    return Math.floor(Math.random() * 1000);
}

async function handleGiveawayTicket(ctx) {
    const roundId = await getCurrentRoundId();
    if (!roundId) {
        await ctx.reply("🎁 No active giveaway at the moment. Please wait for the next round!", { parse_mode: "HTML" });
        return;
    }

    const userId = ctx.from.id;

    const existing = await db.query(
        "SELECT ticket_number FROM giveaway_tickets WHERE user_id = $1 AND round_id = $2",
        [userId, roundId]
    );
    if (existing.rows.length > 0) {
        await ctx.reply(`🎟️ You already have a ticket! Your number is <b>${existing.rows[0].ticket_number}</b>. Good luck!`, { parse_mode: "HTML" });
        return;
    }

    const countResult = await db.query(
        "SELECT COUNT(*) FROM giveaway_tickets WHERE round_id = $1",
        [roundId]
    );
    const totalTickets = parseInt(countResult.rows[0].count);
    if (totalTickets >= 1000) {
        await ctx.reply("😞 Sorry, all tickets for this giveaway have been claimed. Wait for the next round!", { parse_mode: "HTML" });
        return;
    }

    let ticketNum;
    let attempts = 0;
    let unique = false;
    while (!unique && attempts < 50) {
        ticketNum = generateTicketNumber();
        const check = await db.query(
            "SELECT id FROM giveaway_tickets WHERE round_id = $1 AND ticket_number = $2",
            [roundId, ticketNum]
        );
        if (check.rows.length === 0) unique = true;
        attempts++;
    }
    if (!unique) {
        const used = await db.query(
            "SELECT ticket_number FROM giveaway_tickets WHERE round_id = $1 ORDER BY ticket_number",
            [roundId]
        );
        const usedSet = new Set(used.rows.map(r => r.ticket_number));
        for (let i = 0; i <= 999; i++) {
            if (!usedSet.has(i)) {
                ticketNum = i;
                unique = true;
                break;
            }
        }
        if (!unique) {
            await ctx.reply("❌ Error: All ticket numbers are taken. Please contact support.", { parse_mode: "HTML" });
            return;
        }
    }

    await db.query(
        "INSERT INTO giveaway_tickets (user_id, ticket_number, round_id) VALUES ($1, $2, $3)",
        [userId, ticketNum, roundId]
    );

    await db.query(
        `INSERT INTO users (telegram_id, username, created_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (telegram_id) DO NOTHING`,
        [userId, ctx.from.username || null]
    );

    const emojiText = "🎟️";
    await ctx.reply(`${emojiText} Your lucky ticket number is <b>${ticketNum}</b>!\n\nYou have been entered into the giveaway. Good luck!`, { parse_mode: "HTML" });
}

// =====================
// 🟢 MY ORDERS
// =====================
function getStatusEmoji(status) {
    const map = { PENDING: "⏳", APPROVED: "✅", COMPLETED: "🎉", REJECTED: "❌" };
    return map[status] || "📦";
}
function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
async function sendNewTextMessage(ctx, text, inlineKeyboard) {
    const replyMarkup = inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined;
    if (ctx.callbackQuery && ctx.callbackQuery.message) await ctx.reply(text, { parse_mode: "HTML", reply_markup: replyMarkup });
    else await ctx.reply(text, { parse_mode: "HTML", reply_markup: replyMarkup });
}
async function showMyOrders(ctx) {
    const userId = ctx.from.id;
    try {
        const orders = await db.query(
            `SELECT id, product_name, price_etb, status, created_at, delivery_type FROM orders WHERE telegram_id = $1 ORDER BY id DESC LIMIT 20`,
            [userId]
        );
        if (orders.rows.length === 0) {
            await safeEdit(ctx, "📭 No orders found.", [[{ text: "🛒 Start Shopping", callback_data: "main_menu" }]]);
            return;
        }
        const emojiText = "📋 YOUR ORDERS";
        let message = `${emojiText}\n\n`;
        for (let i = 0; i < orders.rows.length; i++) {
            const o = orders.rows[i];
            const emoji = getStatusEmoji(o.status);
            message += `${i + 1}. ${emoji} #${o.id} - ${o.product_name}\n   💰 ${o.price_etb} ETB | ${o.status}\n   📅 ${formatDate(o.created_at)}\n\n`;
        }
        message += "Click an order below to see details 👇";
        const buttons = orders.rows.slice(0, 10).map((o) => [
            { text: `📦 Order #${o.id} - ${o.status}`, callback_data: `order_detail_${o.id}` },
        ]);
        buttons.push([{ text: "🔙 Back", callback_data: "back" }]);
        buttons.push([{ text: "🏠 Main Menu", callback_data: "main_menu" }]);
        await sendNewTextMessage(ctx, message, buttons);
    } catch (error) {
        console.error("My orders error:", error);
        await sendNewTextMessage(ctx, "⚠️ Error loading your orders.", []);
    }
}
async function showOrderDetail(ctx, orderId) {
    const userId = ctx.from.id;
    try {
        const order = await db.query(`SELECT * FROM orders WHERE id = $1 AND telegram_id = $2`, [orderId, userId]);
        if (order.rows.length === 0) return ctx.reply("❌ Order not found.", { parse_mode: "HTML" });
        const o = order.rows[0];
        const emoji = getStatusEmoji(o.status);
        let message = `${emoji} ORDER #${o.id} DETAILS\n\n📦 Product: ${o.product_name}\n💰 Amount: ${o.price_etb} ETB\n📊 Status: ${o.status}\n📅 Date: ${formatDate(o.created_at)}\n`;
        if (o.player_id) message += `\n🎮 Player ID: ${o.player_id}\n`;
        if (o.player_name) message += `👤 Player Name: ${o.player_name}\n`;
        if (o.user_inputs) {
            const inputs = parseUserInputs(o.user_inputs);
            if (inputs) {
                message += `\n📋 Your Information:\n`;
                if (inputs.email) message += `📧 Email: ${inputs.email}\n`;
                if (inputs.phone) message += `📱 Phone: ${inputs.phone}\n`;
                if (inputs.username) message += `👤 Username: ${inputs.username}\n`;
                if (inputs.player_id) message += `🆔 Player ID: ${inputs.player_id}\n`;
            }
        }
        let statusMsg = "";
        if (o.status === "PENDING") statusMsg = "\n⏳ Your order is pending approval.";
        else if (o.status === "APPROVED") statusMsg = "\n✅ Payment approved! Delivery in progress...";
        else if (o.status === "COMPLETED") statusMsg = "\n🎉 Order completed!";
        else if (o.status === "REJECTED") statusMsg = "\n❌ Order rejected.";
        message += statusMsg;
        const buttons = [[{ text: "🔙 Back to My Orders", callback_data: "myorders_back" }]];
        await ctx.editMessageText(message, { parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
    } catch (error) {
        console.error("Order detail error:", error);
        await ctx.reply("⚠️ Error loading order details.", { parse_mode: "HTML" });
    }
}

// =====================
// 🟢 SUPPORT
// =====================
async function showSupport(ctx) {
    const emojiText = "📞 CONTACT SUPPORT";
    const message = `${emojiText}\n\nHaving issues? Need help?\n\n📱 Telegram: ${process.env.ADMIN_USERNAME || "Contact Admin"}\n✉️ Response Time: Usually within 1 hour\n\nSend us a message below!`;
    const buttons = [
        [{ text: "📩 Message Admin", url: `https://t.me/${process.env.ADMIN_USERNAME?.replace("@", "") || "natan_topup"}` }],
        [{ text: "🔙 Back", callback_data: "back" }],
        [{ text: "🏠 Main Menu", callback_data: "main_menu" }],
    ];
    await safeEdit(ctx, message, buttons);
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    try {
        await ctx.telegram.sendMessage(process.env.ADMIN_ID, `📞 Support Request\n\n👤 User: ${username}\n🆔 ID: ${ctx.from.id}\n\nUser requested support.`);
    } catch (e) { console.error("Failed to send admin notification:", e.message); }
}

// =====================
// 🟢 COMMANDS
// =====================
bot.start(async (ctx) => {
    delete userState[ctx.from.id];
    clearHistory(ctx.from.id);
    await showMainMenu(ctx);
});
bot.command("myorders", async (ctx) => { await showMyOrders(ctx); });
bot.command("support", async (ctx) => { await showSupport(ctx); });
bot.command("cancel", async (ctx) => {
    delete userState[ctx.from.id];
    clearHistory(ctx.from.id);
    await ctx.reply("❌ Order Cancelled.", { parse_mode: "HTML" });
    await showMainMenu(ctx);
});
bot.command("channel", async (ctx) => {
    const channelUsername = process.env.CHANNEL_USERNAME || "natan_topup";
    const channelLink = `https://t.me/${channelUsername.replace("@", "")}`;
    const emojiText = "📢 OUR OFFICIAL CHANNEL";
    const message = `${emojiText}\n\nJoin for updates, offers, and giveaways!\n\nClick below to join.`;
    const buttons = [
        [{ text: "📢 Join Our Channel", url: channelLink }],
        [{ text: "🔙 Back", callback_data: "back" }],
        [{ text: "🏠 Main Menu", callback_data: "main_menu" }],
    ];
    await safeEdit(ctx, message, buttons);
});
bot.command("info", async (ctx) => {
    const emojiText = "ℹ️ ABOUT NATAN TOP UP";
    const message = `${emojiText}\n\nVersion: 2.0.0\nPlatform: Telegram Bot\n\nFEATURES:\n✅ 24/7 Service\n✅ Instant & Manual Delivery\n✅ Secure Payment\n✅ Order Tracking\n✅ Customer Support\n\nSUPPORTED:\n🎮 PUBG UC\n🎮 Free Fire\n📱 TikTok Coins\n\nContact: ${process.env.ADMIN_USERNAME || "@admin"}\n\nThank you! 🚀`;
    const buttons = [
        [{ text: "🔙 Back", callback_data: "back" }],
        [{ text: "🏠 Main Menu", callback_data: "main_menu" }],
    ];
    await safeEdit(ctx, message, buttons);
});
bot.command("help", async (ctx) => {
    const emojiText = "❓ HELP & GUIDE";
    const message = `${emojiText}\n\nCommands:\n/start - Main menu\n/myorders - View orders\n/support - Contact support\n/channel - Join channel\n/info - About bot\n/help - This message\n/cancel - Cancel current order\n\nHow to Order:\n1. Select category\n2. Choose product\n3. Enter ID/credentials\n4. Confirm\n5. Select payment\n6. Send screenshot\n\nNeed help? Use /support`;
    const buttons = [
        [{ text: "🔙 Back", callback_data: "back" }],
        [{ text: "🏠 Main Menu", callback_data: "main_menu" }],
    ];
    await safeEdit(ctx, message, buttons);
});
bot.command("debug", async (ctx) => {
    const userId = ctx.from.id;
    const state = userState[userId] || {};
    await ctx.reply(`User State:\n${JSON.stringify(state, null, 2)}`);
});

// =====================
// 🟢 SHOW PRODUCTS BY CATEGORY (for categories without subcategories)
// =====================
async function showProductsByCategory(ctx, categoryId) {
    try {
        const categoryResult = await db.query("SELECT * FROM categories WHERE id = $1 AND is_active = true", [categoryId]);
        const category = categoryResult.rows[0];
        
        const result = await db.query(
            `SELECT * FROM products WHERE category_id = $1 AND is_active = true ORDER BY position ASC, id ASC`,
            [categoryId]
        );
        
        if (result.rows.length === 0) {
            await safeEdit(ctx, "📭 No products available right now.", [
                [{ text: "🔙 Back", callback_data: "back" }],
                [{ text: "❌ Cancel Order", callback_data: "cancel_order" }]
            ]);
            return;
        }
        
        const buttons = buildButtons(
            result.rows.map((p) => ({
                text: `${p.name} - ${p.price_etb} ETB`,
                callback_data: `db_${p.id}_${p.price_etb}_${p.product_type}_${p.name.replace(/ /g, "_")}`,
            })),
            true
        );
        buttons.push([{ text: "🔙 Back", callback_data: "back" }]);
        buttons.push([{ text: "❌ Cancel Order", callback_data: "cancel_order" }]);
        buttons.push([{ text: "🏠 Main Menu", callback_data: "main_menu" }]);
        
        let title = "📦 Select Product:";
        if (result.rows[0]?.product_type === "free_fire") title = "🔥 Free Fire Diamonds:";
        
        const categoryImage = category?.image_url || "https://assets-prd.ignimgs.com/2025/07/16/25-best-ps5-games-blogroll-1752704467824.jpg";
        
        await safeEditMedia(ctx, categoryImage, title, buttons);
    } catch (error) {
        console.error("Products by category error:", error);
        await safeEdit(ctx, "⚠️ Error loading products.", [[{ text: "🔙 Back", callback_data: "back" }]]);
    }
}

// =====================
// 🟢 CALLBACK QUERY
// =====================
bot.on("callback_query", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    if (data === "noop") return ctx.answerCbQuery("Please wait...");
    if (!userState[userId]) userState[userId] = {};
    const state = userState[userId];
    await ctx.answerCbQuery();

    // ----- CANCEL ORDER -----
    if (data === "cancel_order") {
        delete userState[userId];
        clearHistory(userId);
        try {
            await ctx.editMessageText("❌ Order Cancelled.", { parse_mode: "HTML" });
        } catch (e) {
            await ctx.reply("❌ Order Cancelled.", { parse_mode: "HTML" });
        }
        return showMainMenu(ctx);
    }

    // ----- MAIN MENU -----
    if (data === "main_menu") {
        delete userState[userId];
        clearHistory(userId);
        return showMainMenu(ctx);
    }
    
    // ----- BACK BUTTON -----
    if (data === "back") {
        const prev = getPreviousScreen(userId);
        if (prev) {
            popHistory(userId);
            
            if (prev.screen === "categories") {
                return showCategories(ctx);
            }
            if (prev.screen === "products") {
                if (prev.data?.subId) {
                    return showDatabaseProducts(ctx, prev.data.subId);
                }
            }
            if (prev.screen === "subcategories") {
                if (prev.data?.categoryId) {
                    const categoryResult = await db.query(
                        "SELECT * FROM categories WHERE id = $1 AND is_active = true", 
                        [prev.data.categoryId]
                    );
                    const category = categoryResult.rows[0];
                    if (category) {
                        const subs = await db.query(
                            "SELECT * FROM subcategories WHERE category_id=$1 AND is_active=true ORDER BY position", 
                            [prev.data.categoryId]
                        );
                        const buttons = buildButtons(
                            subs.rows.map((s) => ({ 
                                text: s.display_name, 
                                callback_data: `sub_${s.id}_${s.name}` 
                            }))
                        );
                        buttons.push([{ text: "🔙 Back", callback_data: "back" }]);
                        buttons.push([{ text: "🏠 Main Menu", callback_data: "main_menu" }]);
                        
                        const categoryImage = category.image_url || "https://assets-prd.ignimgs.com/2025/07/16/25-best-ps5-games-blogroll-1752704467824.jpg";
                        const caption = `📂 ${category.display_name}\n\nSelect an option below 👇`;
                        
                        return safeEditMedia(ctx, categoryImage, caption, buttons);
                    }
                }
            }
            if (prev.screen === "wallet") return showWallet(ctx);
            if (prev.screen === "deposit_amounts") return showDepositAmounts(ctx);
            if (prev.screen === "myorders") return showMyOrders(ctx);
            if (prev.screen === "support") return showSupport(ctx);
            if (prev.screen === "main_menu") return showMainMenu(ctx);
            
            return showMainMenu(ctx);
        }
        return showMainMenu(ctx);
    }

    // ----- DEPOSIT FLOW -----
    if (data.startsWith("deposit_paymethod_")) {
        delete userState[userId].orderPending;
        delete userState[userId].orderId;
        delete userState[userId].productInfo;
        const parts = data.split("_");
        const methodId = parseInt(parts[2]);
        const amount = parseInt(parts[3]);
        if (isNaN(amount)) {
            await safeEdit(ctx, "❌ Invalid amount. Please start deposit again.", [[{ text: "💰 Deposit", callback_data: "wallet_deposit" }]]);
            return;
        }
        const methods = await getPaymentMethods();
        const selectedMethod = methods.find((m) => m.id === methodId);
        if (!selectedMethod) {
            await safeEdit(ctx, "❌ Payment method not found.", []);
            return;
        }
        userState[userId].depositMethod = selectedMethod;
        userState[userId].depositAmount = amount;
        userState[userId].step = "DEPOSIT_PAYMENT_WAITING";
        const details = `💰 DEPOSIT REQUEST\n\nAmount: ${amount} ETB\n🏦 ${selectedMethod.name}\n📞 Account: ${selectedMethod.account_number}\n👤 Name: ${selectedMethod.account_name || "N/A"}\n\n${selectedMethod.instructions || "Send payment screenshot here after transfer"}\n\n⚠️ Send the screenshot in this chat\nType /cancel to cancel`;
        await ctx.reply(details, { parse_mode: "HTML" });
        return;
    }
    if (data.startsWith("deposit_") && !data.startsWith("deposit_paymethod_")) {
        const amount = parseInt(data.split("_")[1]);
        if (isNaN(amount)) {
            await safeEdit(ctx, "❌ Invalid amount selected. Please try again.", []);
            return;
        }
        pushHistory(userId, "deposit_amounts");
        return showDepositPaymentMethods(ctx, amount);
    }

    // ----- WALLET NAVIGATION -----
    if (data === "wallet_deposit") {
        pushHistory(userId, "wallet");
        return showDepositAmounts(ctx);
    }
    if (data === "wallet_history") {
        pushHistory(userId, "wallet");
        return showTransactionHistory(ctx);
    }
    if (data === "show_wallet") {
        pushHistory(userId, "main_menu");
        return showWallet(ctx);
    }
    if (data === "giveaway_ticket") {
        return handleGiveawayTicket(ctx);
    }

    // ----- BOTTOM MENU NAVIGATION -----
    if (data === "myorders_back" || data === "📋 My Orders") {
        pushHistory(userId, "main_menu");
        return showMyOrders(ctx);
    }
    if (data === "support_menu" || data === "📞 Support") {
        pushHistory(userId, "main_menu");
        return showSupport(ctx);
    }
    if (data === "show_products" || data === "🛒 Products") {
        pushHistory(userId, "main_menu");
        return showCategories(ctx);
    }
    if (data === "show_games" || data === "🎮 Games") {
        pushHistory(userId, "main_menu");
        const gameCategories = await db.query("SELECT * FROM categories WHERE is_active=true AND name IN ('pubg', 'free_fire') ORDER BY position");
        const buttons = buildButtonsHorizontal(gameCategories.rows.map((g) => ({ text: g.display_name, callback_data: `cat_${g.id}` })));
        buttons.push([{ text: "🔙 Back", callback_data: "back" }]);
        buttons.push([{ text: "🏠 Main Menu", callback_data: "main_menu" }]);
        return safeEdit(ctx, "🎮 Select Game:", buttons);
    }
    if (data === "info_menu") {
        const emojiText = "ℹ️ ABOUT NATAN TOP UP";
        const message = `${emojiText}\n\nVersion: 2.0.0\nPlatform: Telegram Bot\n\nFEATURES:\n✅ 24/7 Service\n✅ Instant & Manual Delivery\n✅ Secure Payment\n✅ Order Tracking\n✅ Customer Support\n\nSUPPORTED:\n🎮 PUBG UC\n🎮 Free Fire\n📱 TikTok Coins\n\nContact: ${process.env.ADMIN_USERNAME || "@admin"}\n\nThank you! 🚀`;
        return ctx.editMessageText(message, { parse_mode: "HTML" });
    }
    if (data === "help_menu") {
        const emojiText = "❓ HELP & GUIDE";
        const message = `${emojiText}\n\nCommands:\n/start - Main menu\n/myorders - View orders\n/support - Contact support\n/channel - Join channel\n/info - About bot\n/help - This message\n/cancel - Cancel current order\n\nHow to Order:\n1. Select category\n2. Choose product\n3. Enter ID/credentials\n4. Confirm\n5. Select payment\n6. Send screenshot\n\nNeed help? Use /support`;
        return ctx.editMessageText(message, { parse_mode: "HTML" });
    }

    // ----- ORDER DETAIL -----
    if (data.startsWith("order_detail_")) {
        const orderId = data.split("_")[2];
        return showOrderDetail(ctx, orderId);
    }

    // ----- CATEGORY SELECTION -----
    if (data.startsWith("cat_")) {
        const categoryId = data.split("_")[1];
        const categoryResult = await db.query("SELECT * FROM categories WHERE id = $1 AND is_active = true", [categoryId]);
        const category = categoryResult.rows[0];
        if (!category) return ctx.reply("❌ Category not found.");
        
        const subs = await db.query("SELECT * FROM subcategories WHERE category_id=$1 AND is_active=true ORDER BY position", [categoryId]);
        const buttons = buildButtons(
            subs.rows.map((s) => ({ text: s.display_name, callback_data: `sub_${s.id}_${s.name}` }))
        );
        buttons.push([{ text: "🔙 Back", callback_data: "back" }]);
        buttons.push([{ text: "🏠 Main Menu", callback_data: "main_menu" }]);
        
        const categoryImage = category.image_url || "https://assets-prd.ignimgs.com/2025/07/16/25-best-ps5-games-blogroll-1752704467824.jpg";
        const caption = `📂 ${category.display_name}\n\nSelect an option below 👇`;
        
        if (subs.rows.length === 0) {
            pushHistory(userId, "categories");
            return showProductsByCategory(ctx, categoryId);
        }
        
        pushHistory(userId, "categories");
        await safeEditMedia(ctx, categoryImage, caption, buttons);
        return;
    }

    // ----- SUBCATEGORY -----
    if (data.startsWith("sub_")) {
        const [, subId, name] = data.split("_");
        
        const subResult = await db.query("SELECT * FROM subcategories WHERE id = $1", [subId]);
        const subcategory = subResult.rows[0];
        
        pushHistory(userId, "subcategories", { 
            categoryId: subcategory?.category_id 
        });
        
        if (name === "instant" || name === "uc_instant") {
            state.mode = "instant";
            return showRagnerProducts(ctx);
        }
        
        state.mode = "database";
        return showDatabaseProducts(ctx, subId);
    }
    
    // ----- RAGNER PRODUCT -----
    if (data.startsWith("ragner_")) {
        const parts = data.split("_");
        const id = parts[1];
        const price = parseFloat(parts[2]);
        const name = parts.slice(3).join(" ");
        const productInfo = { productId: id, price, name, type: "ragner", product_type: "uc_instant" };
        state.product = productInfo;
        state.step = "PLAYER";
        return ctx.reply("🎮 Enter Player ID:\n\nExample: 51807260252\n\nType /cancel to cancel", { parse_mode: "HTML" });
    }

    // ----- DATABASE PRODUCT -----
    if (data.startsWith("db_")) {
        const parts = data.split("_");
        const productId = parts[1];
        const price = parseFloat(parts[2]);
        const productType = parts[3];
        const name = parts.slice(4).join(" ");
        const productResult = await db.query("SELECT * FROM products WHERE id = $1", [productId]);
        const product = productResult.rows[0];
        if (!product) { await ctx.reply("❌ Product not found.", { parse_mode: "HTML" }); return; }
        const productInfo = { productId, price, name, fullProduct: product, product_type: productType };
        state.product = productInfo;
        if (productType === "tiktok" && product.warning_message && product.warning_message !== "none") {
            return showWarningMessage(ctx, product);
        }
        return askForFields(ctx, product);
    }

    // ----- CONTINUE AFTER WARNING -----
    if (data.startsWith("continue_")) {
        const product = state.product?.fullProduct;
        if (product) return askForFields(ctx, product);
    }

    // ----- PAY WITH WALLET -----
    if (data.startsWith("pay_wallet_")) {
        const productInfo = {
            productId: state.product.productId,
            price: state.product.price,
            name: state.product.name,
            playerId: state.playerId,
            playerName: state.playerName,
            userInputs: state.collectedData,
            type: state.product.type,
            product_type: state.product.product_type
        };
        await processWalletPayment(ctx, productInfo);
        return;
    }

    // ----- PAY WITH BANK TRANSFER -----
    if (data.startsWith("pay_bank_")) {
        delete userState[userId].depositPending;
        delete userState[userId].depositAmount;
        delete userState[userId].depositMethod;
        const parts = data.split("_");
        const productId = parts[2];
        const price = parseFloat(parts[3]);
        const name = parts.slice(4).join(" ");
        const productInfo = {
            productId,
            price,
            name,
            type: state.product?.type,
            product_type: state.product?.product_type,
            playerId: state.playerId,
            playerName: state.playerName,
            userInputs: state.collectedData,
        };
        userState[userId].productInfo = productInfo;
        await showBankTransferMethods(ctx, productInfo);
        return;
    }
    
    // ----- PAYMENT METHOD SELECTION (Bank Transfer) -----
    if (data.startsWith("payment_")) {
        const parts = data.split("_");
        const methodId = parseInt(parts[1]);
        const productId = parts[2];
        const price = parseFloat(parts[3]);
        const name = parts.slice(4).join(" ");
        const methods = await getPaymentMethods();
        const selectedMethod = methods.find((m) => m.id === methodId);
        if (!selectedMethod) {
            await safeEdit(ctx, "❌ Payment method not found.", []);
            return;
        }
        const productInfo = state.productInfo || {
            productId,
            price,
            name,
            type: state.product?.type,
            product_type: state.product?.product_type,
            playerId: state.playerId,
            playerName: state.playerName,
            userInputs: state.collectedData,
        };
        userState[userId].productInfo = productInfo;
        await showPaymentDetails(ctx, selectedMethod, productInfo);
        return;
    }

    // ----- CONFIRM YES -----
    if (data === "confirm_yes") {
        if (state.product) {
            state.step = "PAY";
            const productInfo = {
                productId: state.product.productId,
                price: state.product.price,
                name: state.product.name,
                playerId: state.playerId,
                playerName: state.playerName,
                userInputs: state.collectedData,
                type: state.product.type,                 
                product_type: state.product.product_type  
            };
            return showPaymentOptions(ctx, productInfo);
        }
    }

    // ----- CONFIRM NO -----
    if (data === "confirm_no") {
        delete userState[userId];
        await ctx.editMessageText("❌ Order cancelled. Type /start to begin again.", { parse_mode: "HTML" });
        return showMainMenu(ctx);
    }

    // ----- ADMIN: APPROVE DEPOSIT -----
    if (data.startsWith("approve_deposit_")) {
        const depositId = data.split("_")[2];
        if (processingOrders.has(`deposit_${depositId}`)) return ctx.answerCbQuery("Processing... Please wait.");
        processingOrders.add(`deposit_${depositId}`);
        try {
            const deposit = (await db.query("SELECT * FROM deposit_requests WHERE id = $1", [depositId])).rows[0];
            if (!deposit) { processingOrders.delete(`deposit_${depositId}`); return ctx.editMessageCaption("❌ Deposit request not found"); }
            const depositAmount = parseFloat(deposit.amount);
            await db.query("UPDATE deposit_requests SET status = 'APPROVED', processed_at = CURRENT_TIMESTAMP WHERE id = $1", [depositId]);
            await updateWalletBalance(deposit.telegram_id, depositAmount, "DEPOSIT", depositId, `Deposit of ${depositAmount} ETB`);
            await ctx.telegram.sendMessage(deposit.telegram_id, `✅ DEPOSIT APPROVED!\n\n💰 Amount: ${depositAmount} ETB has been added to your wallet.`, { parse_mode: "HTML" });
            await ctx.editMessageCaption(`✅ Deposit #${depositId} - APPROVED\nAmount: ${depositAmount} ETB\nAdded to user's wallet`);
            processingOrders.delete(`deposit_${depositId}`);
        } catch (error) {
            console.error("Approve deposit error:", error);
            processingOrders.delete(`deposit_${depositId}`);
            await ctx.editMessageCaption("⚠️ Error processing deposit approval");
        }
        return;
    }

    // ----- ADMIN: REJECT DEPOSIT -----
    if (data.startsWith("reject_deposit_")) {
        const depositId = data.split("_")[2];
        try {
            await db.query("UPDATE deposit_requests SET status = 'REJECTED', processed_at = CURRENT_TIMESTAMP WHERE id = $1", [depositId]);
            const deposit = (await db.query("SELECT * FROM deposit_requests WHERE id = $1", [depositId])).rows[0];
            if (deposit) {
                await ctx.telegram.sendMessage(deposit.telegram_id, `❌ DEPOSIT REJECTED\n\nAmount: ${deposit.amount} ETB\n\nPlease contact support.`, { parse_mode: "HTML" });
            }
            await ctx.editMessageCaption(`❌ Deposit #${depositId} - REJECTED`);
        } catch (error) {
            console.error("Reject deposit error:", error);
            await ctx.editMessageCaption("⚠️ Error rejecting deposit");
        }
        return;
    }

    // ----- ADMIN: APPROVE ORDER -----
    if (data.startsWith("approve_")) {
        const orderId = data.split("_")[1];
        if (processingOrders.has(orderId)) return ctx.answerCbQuery("Processing... Please wait.");
        processingOrders.add(orderId);
        await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: "⏳ Processing...", callback_data: "noop" }]] });
        try {
            const order = (await db.query("SELECT * FROM orders WHERE id=$1", [orderId])).rows[0];
            if (!order) { processingOrders.delete(orderId); return ctx.editMessageText("❌ Order not found"); }
            let orderDetails = buildOrderDetails(order);
            await db.query("UPDATE orders SET status='APPROVED' WHERE id=$1", [orderId]);
            if (order.delivery_type === "ragner") {
                const validation = await validatePlayer(order.external_product_id, order.player_id);
                if (!validation || !validation.success) {
                    await ctx.telegram.sendMessage(order.telegram_id, "⚠️ Payment approved but player validation failed. Contact support.", { parse_mode: "HTML" });
                    processingOrders.delete(orderId);
                    const msg = `${orderDetails}\n━━━━━━━━━━━━━━━━━━━━\n⚠️ STATUS: APPROVED (Validation Failed)\n❌ Auto-delivery unavailable. Please deliver manually.\n\n👇 Click "Complete" after manual delivery`;
                    const btns = [[{ text: "🎮 Complete Delivery", callback_data: `complete_${orderId}` }], [{ text: "❌ Reject Order", callback_data: `reject_${orderId}` }]];
                    if (ctx.callbackQuery.message.photo) await ctx.editMessageCaption(msg, { reply_markup: { inline_keyboard: btns } });
                    else await ctx.editMessageText(msg, { reply_markup: { inline_keyboard: btns } });
                    return;
                }
                const result = await createOrder(order.external_product_id, order.player_id);
                if (result && result.success) {
                    await db.query("UPDATE orders SET status='COMPLETED' WHERE id=$1", [orderId]);
                    await ctx.telegram.sendMessage(order.telegram_id, "🎮 UC Delivered Successfully!", { parse_mode: "HTML" });
                    processingOrders.delete(orderId);
                    const msg = `${orderDetails}\n━━━━━━━━━━━━━━━━━━━━\n✅ STATUS: COMPLETED\n🎮 UC Delivered Successfully!`;
                    if (ctx.callbackQuery.message.photo) await ctx.editMessageCaption(msg);
                    else await ctx.editMessageText(msg);
                    return;
                } else {
                    const errorMsg = result?.error || result?.details?.message || "Unknown error";
                    console.error(`Auto-delivery failed: ${errorMsg}`);
                    await ctx.telegram.sendMessage(order.telegram_id, "✅ Payment approved! Delivery in progress.", { parse_mode: "HTML" });
                    processingOrders.delete(orderId);
                    const msg = `${orderDetails}\n━━━━━━━━━━━━━━━━━━━━\n⚠️ STATUS: APPROVED\n❌ Auto-delivery failed: ${errorMsg}\n\n👇 Click "Complete" after manual delivery`;
                    const btns = [[{ text: "🎮 Complete Delivery", callback_data: `complete_${orderId}` }], [{ text: "❌ Reject Order", callback_data: `reject_${orderId}` }]];
                    if (ctx.callbackQuery.message.photo) await ctx.editMessageCaption(msg, { reply_markup: { inline_keyboard: btns } });
                    else await ctx.editMessageText(msg, { reply_markup: { inline_keyboard: btns } });
                    return;
                }
            }
            await ctx.telegram.sendMessage(order.telegram_id, "✅ Payment approved! Delivery in progress.", { parse_mode: "HTML" });
            processingOrders.delete(orderId);
            const msg = `${orderDetails}\n━━━━━━━━━━━━━━━━━━━━\n✅ STATUS: APPROVED\n📦 Manual delivery - click "Complete" after delivering`;
            const btns = [[{ text: "🎮 Complete Delivery", callback_data: `complete_${orderId}` }], [{ text: "❌ Reject Order", callback_data: `reject_${orderId}` }]];
            if (ctx.callbackQuery.message.photo) await ctx.editMessageCaption(msg, { reply_markup: { inline_keyboard: btns } });
            else await ctx.editMessageText(msg, { reply_markup: { inline_keyboard: btns } });
        } catch (error) {
            console.error("Approve error:", error);
            processingOrders.delete(orderId);
            await ctx.editMessageText(`❌ Error processing approval: ${error.message}`);
        }
        return;
    }

    // ----- ADMIN: COMPLETE ORDER -----
    if (data.startsWith("complete_")) {
        const orderId = data.split("_")[1];
        if (processingOrders.has(`complete_${orderId}`)) return ctx.answerCbQuery("Processing... Please wait.");
        processingOrders.add(`complete_${orderId}`);
        try {
            const order = (await db.query("SELECT * FROM orders WHERE id=$1", [orderId])).rows[0];
            if (!order) { processingOrders.delete(`complete_${orderId}`); return ctx.editMessageText("❌ Order not found"); }
            let orderDetails = buildOrderDetails(order);
            await db.query("UPDATE orders SET status='COMPLETED' WHERE id=$1", [orderId]);
            await ctx.telegram.sendMessage(order.telegram_id, "🎮 Order Delivered Successfully!", { parse_mode: "HTML" });
            processingOrders.delete(`complete_${orderId}`);
            const msg = `${orderDetails}\n━━━━━━━━━━━━━━━━━━━━\n✅ STATUS: COMPLETED\n🎮 Order delivered successfully!`;
            if (ctx.callbackQuery.message.photo) await ctx.editMessageCaption(msg);
            else await ctx.editMessageText(msg);
        } catch (error) {
            console.error("Complete error:", error);
            processingOrders.delete(`complete_${orderId}`);
            await ctx.reply("✅ Order completed successfully!");
        }
        return;
    }

    // ----- ADMIN: REJECT ORDER -----
    if (data.startsWith("reject_")) {
        const orderId = data.split("_")[1];
        try {
            const order = (await db.query("SELECT * FROM orders WHERE id=$1", [orderId])).rows[0];
            if (!order) return ctx.editMessageText("❌ Order not found");
            let orderDetails = buildOrderDetails(order);
            await db.query("UPDATE orders SET status='REJECTED' WHERE id=$1", [orderId]);
            await ctx.telegram.sendMessage(order.telegram_id, "❌ Payment rejected. Please contact support.", { parse_mode: "HTML" });
            const msg = `${orderDetails}\n━━━━━━━━━━━━━━━━━━━━\n❌ STATUS: REJECTED`;
            if (ctx.callbackQuery.message.photo) await ctx.editMessageCaption(msg);
            else await ctx.editMessageText(msg);
        } catch (error) {
            console.error("Reject error:", error);
            await ctx.editMessageText("⚠️ Error rejecting order");
        }
        return;
    }
});

// =====================
// 🟢 TEXT MESSAGE (Player ID input & Transaction ID)
// =====================
bot.on("text", async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;
    const state = userState[userId];

    if (text.toLowerCase() === "/cancel" || text.toLowerCase() === "cancel") {
        delete userState[userId];
        clearHistory(userId);
        await ctx.reply("❌ Order Cancelled.", { parse_mode: "HTML" });
        return showMainMenu(ctx);
    }

    // Handle player ID input
    if (!state || state.step !== "PLAYER") return;
    const input = ctx.message.text.trim();
    const product = state.product?.fullProduct;
    if (!input) return ctx.reply("❌ Invalid input. Please try again.\n\nType /cancel to cancel");

    const pubgTypes = ["free_fire", "uc_manual", "grospack", "subscription", "uc_instant"];

    if (state.product?.type === "ragner" || pubgTypes.includes(state.product?.product_type)) {
        state.playerId = input;
        
        try {
            const waitMsg = await ctx.reply("🔍 Verifying Player ID...");
            
            let validation;
            if (state.product?.type === "ragner") {
                validation = await validatePlayer(state.product.productId, input);
            } else {
                validation = await validatePlayerOnly(input);
            }
            
            try { await ctx.telegram.deleteMessage(waitMsg.chat.id, waitMsg.message_id); } catch(e) {}
            
            if (!validation || !validation.success) {
                return ctx.reply("❌ Invalid Player ID.\n\nPlayer not found. Please check and try again.\n\nType /cancel to cancel");
            }
            state.playerName = validation.data?.nickname || "Unknown Player";
        } catch (error) {
            console.error("Validation error:", error);
            return ctx.reply("⏳ Service busy. Please try again in 2 minutes.\n\nType /cancel to cancel");
        }
        
        state.step = "CONFIRM";
        let confirmMessage = "✅ Verification Successful\n\n";
        confirmMessage += `👤 Name: ${state.playerName}\n`;
        confirmMessage += `🆔 ID: ${input}\n\nIs this correct?`;
        
        return ctx.reply(confirmMessage, {
            reply_markup: { 
                inline_keyboard: [
                    [{ text: "✅ Yes", callback_data: "confirm_yes" }, { text: "❌ No", callback_data: "confirm_no" }],
                    [{ text: "❌ Cancel Order", callback_data: "cancel_order" }]
                ] 
            },
        });
    } else if (state.requiredFields && state.requiredFields.length > 0 && state.currentField !== undefined) {
        return processFieldInput(ctx, product, state, input);
    }
});

// =====================
// 🟢 PHOTO MESSAGE (Payment Screenshot) – Auto-extract TX ID with Cloud Vision
// =====================
bot.on("photo", async (ctx) => {
    const userId = ctx.from.id;
    const state = userState[userId];

    console.log("📸 Photo received. state:", JSON.stringify(state, null, 2));

    if (!state || (state.step !== "PAY" && state.step !== "DEPOSIT_PAYMENT_WAITING")) {
        console.log("❌ Not in PAY or DEPOSIT_PAYMENT_WAITING state");
        return ctx.reply("⚠️ Please start a new order with /start", { parse_mode: "HTML" });
    }

    try {
        const fileId = ctx.message.photo.pop().file_id;

        // ----- DEPOSIT FLOW -----
        if (state.step === "DEPOSIT_PAYMENT_WAITING" && state.depositAmount && state.depositMethod) {
            console.log("💰 Deposit flow: processing screenshot");
            
            const scanningMsg = await ctx.reply("🔍 Scanning payment receipt with Cloud Vision...", { parse_mode: "HTML" });
            
            const ocrResult = await extractTxIdFromImage(fileId);
            const extractedTxId = ocrResult?.txId;
            const ocrFullText = ocrResult?.fullText || "";
            
            if (extractedTxId) {
                try {
                    await ctx.telegram.editMessageText(scanningMsg.chat.id, scanningMsg.message_id, null, 
                        `🔍 Transaction ID found: ${extractedTxId}\n⏳ Verifying with ShegerPay...`, { parse_mode: "HTML" });
                } catch(e) {}
                
                const depositAmount = state.depositAmount;
                const method = state.depositMethod;
                const provider = resolveShegerPayProvider(method?.name) || "telebirr";
                const expectedRecipient = method?.account_number || null;
                
                // For BOA, extract sender account and construct full receipt URL
                let senderAccount = null;
                let finalTxId = extractedTxId;
                
                if (provider === "boa") {
                    senderAccount = extractSenderAccount(ocrFullText);
                    console.log("BOA sender account:", senderAccount);
                    
                    // Try to find full URL in OCR text first
                    const urlMatch = ocrFullText.match(/https?:\/\/cs\.bankofabyssinia\.com\/[^\s]+/i);
                    if (urlMatch) {
                        finalTxId = urlMatch[0];
                        console.log("✅ Found BOA receipt URL:", finalTxId);
                    } else if (!extractedTxId.startsWith("http")) {
                        // Construct URL from FT reference
                        finalTxId = `https://cs.bankofabyssinia.com/slip/?trx=${extractedTxId}`;
                        console.log("🔧 Constructed BOA receipt URL:", finalTxId);
                    }
                }
                
                const verification = await verifyPaymentWithTxId(provider, finalTxId, depositAmount, method.account_name, expectedRecipient, senderAccount);
                
                if (verification.verified) {
                    const result = await db.query(
                        `INSERT INTO deposit_requests (telegram_id, amount, payment_method, payment_file_id, status, processed_at, transaction_id)
                         VALUES ($1, $2, $3, $4, 'APPROVED', CURRENT_TIMESTAMP, $5) RETURNING id`,
                        [userId, depositAmount, method.name, fileId, extractedTxId]
                    );
                    const depositId = result.rows[0].id;
                    await updateWalletBalance(userId, depositAmount, "DEPOSIT", depositId, `Deposit of ${depositAmount} ETB (TX: ${extractedTxId})`);
                    
                    try {
                        await ctx.telegram.editMessageText(scanningMsg.chat.id, scanningMsg.message_id, null, 
                            `✅ Deposit of ${depositAmount} ETB automatically verified!\n\nTransaction ID: ${extractedTxId}\n\nYour wallet has been updated.`, { parse_mode: "HTML" });
                    } catch(e) {
                        await ctx.reply(`✅ Deposit of ${depositAmount} ETB automatically verified!\n\nTransaction ID: ${extractedTxId}\n\nYour wallet has been updated.`, { parse_mode: "HTML" });
                    }
                    
                    await ctx.telegram.sendMessage(process.env.ADMIN_ID, 
                        `✅ Auto-verified deposit #${depositId} (Cloud Vision OCR)\n` +
                        `User: @${ctx.from.username || userId}\n` +
                        `Amount: ${depositAmount} ETB\n` +
                        `Method: ${method.name}\n` +
                        `Transaction ID: ${extractedTxId}`
                    );
                    
                    delete userState[userId];
                    setTimeout(() => showMainMenu(ctx), 2000);
                    return;
                } else {
                    // Verification failed - send to admin for manual review
                    try {
                        await ctx.telegram.editMessageText(scanningMsg.chat.id, scanningMsg.message_id, null, 
                            "⚠️ Could not verify automatically.\n\nYour deposit has been submitted for manual review. You will be notified shortly.", { parse_mode: "HTML" });
                    } catch(e) {
                        await ctx.reply("⚠️ Could not verify automatically.\n\nYour deposit has been submitted for manual review. You will be notified shortly.", { parse_mode: "HTML" });
                    }
                    
                    const depositResult = await db.query(
                        `INSERT INTO deposit_requests (telegram_id, amount, payment_method, payment_file_id, status)
                         VALUES ($1, $2, $3, $4, 'PENDING') RETURNING id`,
                        [userId, state.depositAmount, state.depositMethod.name, fileId]
                    );
                    const depositId = depositResult.rows[0].id;
                    
                    await ctx.telegram.sendPhoto(process.env.ADMIN_ID, fileId, {
                        caption: `💰 NEW DEPOSIT (Manual Review - OCR found: ${extractedTxId})\n\n` +
                            `👤 User: @${ctx.from.username || userId}\n` +
                            `💰 Amount: ${state.depositAmount} ETB\n` +
                            `💳 Method: ${state.depositMethod.name}\n` +
                            `🧾 Request ID: #${depositId}\n` +
                            (provider === "boa" ? `🔗 BOA URL sent: ${finalTxId}\n` : '') +
                            `❌ Error: ${verification.error}\n\n` +
                            `Use buttons below to manage:`,
                        reply_markup: { 
                            inline_keyboard: [[
                                { text: "✅ Approve", callback_data: `approve_deposit_${depositId}` }, 
                                { text: "❌ Reject", callback_data: `reject_deposit_${depositId}` }
                            ]] 
                        }
                    });
                    
                    delete userState[userId];
                    setTimeout(() => showMainMenu(ctx), 3000);
                    return;
                }
            } else {
                // No TX ID found - send to admin for manual review
                try {
                    await ctx.telegram.editMessageText(scanningMsg.chat.id, scanningMsg.message_id, null, 
                        "⚠️ Could not read transaction ID from image.\n\nYour screenshot has been sent to our team for manual review. You will be notified shortly.", { parse_mode: "HTML" });
                } catch(e) {
                    await ctx.reply("⚠️ Could not read transaction ID from image.\n\nYour screenshot has been sent to our team for manual review. You will be notified shortly.", { parse_mode: "HTML" });
                }
                
                // Create deposit request and send to admin
                const depositResult = await db.query(
                    `INSERT INTO deposit_requests (telegram_id, amount, payment_method, payment_file_id, status)
                     VALUES ($1, $2, $3, $4, 'PENDING') RETURNING id`,
                    [userId, state.depositAmount, state.depositMethod.name, fileId]
                );
                const depositId = depositResult.rows[0].id;
                
                await ctx.telegram.sendPhoto(process.env.ADMIN_ID, fileId, {
                    caption: `💰 NEW DEPOSIT (Manual Review - Couldn't read TX ID)\n\n` +
                        `👤 User: @${ctx.from.username || userId}\n` +
                        `💰 Amount: ${state.depositAmount} ETB\n` +
                        `💳 Method: ${state.depositMethod.name}\n` +
                        `🧾 Request ID: #${depositId}\n` +
                        `📝 Please verify and manage manually.`,
                    reply_markup: { 
                        inline_keyboard: [[
                            { text: "✅ Approve", callback_data: `approve_deposit_${depositId}` }, 
                            { text: "❌ Reject", callback_data: `reject_deposit_${depositId}` }
                        ]] 
                    }
                });
                
                delete userState[userId];
                setTimeout(() => showMainMenu(ctx), 3000);
                return;
            }
        }

        // ----- BANK TRANSFER PRODUCT FLOW -----
        if (state.step === "PAY" && state.productInfo) {
            const product = state.productInfo;
            console.log("Processing product order:", JSON.stringify(product, null, 2));

            const scanningMsg = await ctx.reply("🔍 Scanning payment receipt...", { parse_mode: "HTML" });
            
            let extractedPlayerId = null, extractedPlayerName = null;
            let userInputs = {};
            if (state.collectedData) {
                userInputs = state.collectedData;
                if (state.collectedData.player_id) {
                    extractedPlayerId = state.collectedData.player_id;
                }
            }
            if (state.playerId && !extractedPlayerId) {
                extractedPlayerId = state.playerId;
                extractedPlayerName = state.playerName || null;
            }

            let productIdToInsert = null;
            let externalProductId = null;
            if (product.type === "ragner") {
                productIdToInsert = null;
                externalProductId = product.productId;
            } else {
                productIdToInsert = product.productId;
                externalProductId = null;
            }

            const result = await db.query(
                `INSERT INTO orders 
                (telegram_id, telegram_username, product_id, external_product_id, product_name, price_etb, 
                 player_id, player_name, delivery_type, payment_file_id, status, user_inputs, payment_method)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', $11, 'bank_transfer')
                RETURNING id`,
                [
                    userId,
                    ctx.from.username || null,
                    productIdToInsert,
                    externalProductId,
                    product.name,
                    product.price,
                    extractedPlayerId,
                    extractedPlayerName,
                    product.type === "ragner" ? "ragner" : "manual",
                    fileId,
                    JSON.stringify(userInputs),
                ]
            );
            const orderId = result.rows[0].id;

            const ocrResult = await extractTxIdFromImage(fileId);
            const extractedTxId = ocrResult?.txId;
            const ocrFullText = ocrResult?.fullText || "";
            
            if (extractedTxId) {
                try {
                    await ctx.telegram.editMessageText(scanningMsg.chat.id, scanningMsg.message_id, null, 
                        `🔍 Transaction ID found: ${extractedTxId}\n⏳ Verifying payment...`, { parse_mode: "HTML" });
                } catch(e) {}
                
                const provider = resolveShegerPayProvider(state.paymentMethod?.name) || "telebirr";
                const method = state.paymentMethod;
                const expectedRecipient = method?.account_number || null;
                
                // For BOA, extract sender account and construct full receipt URL
                let senderAccount = null;
                let finalTxId = extractedTxId;
                
                if (provider === "boa") {
                    senderAccount = extractSenderAccount(ocrFullText);
                    console.log("BOA sender account:", senderAccount);
                    
                    // Try to find full URL in OCR text first
                    const urlMatch = ocrFullText.match(/https?:\/\/cs\.bankofabyssinia\.com\/[^\s]+/i);
                    if (urlMatch) {
                        finalTxId = urlMatch[0];
                        console.log("✅ Found BOA receipt URL:", finalTxId);
                    } else if (!extractedTxId.startsWith("http")) {
                        // Construct URL from FT reference
                        finalTxId = `https://cs.bankofabyssinia.com/slip/?trx=${extractedTxId}`;
                        console.log("🔧 Constructed BOA receipt URL:", finalTxId);
                    }
                }
                
                const verification = await verifyPaymentWithTxId(provider, finalTxId, product.price, method?.account_name, expectedRecipient, senderAccount);
                
                if (verification.verified) {
                    await db.query(`UPDATE orders SET transaction_id = $1, verified_by_shegerpay = true WHERE id = $2`, [extractedTxId, orderId]);
                    
                    const isInstant = product.type === "ragner" || product.product_type === "uc_instant";
                    
                    if (isInstant) {
                        try {
                            const ragnerResult = await createOrder(externalProductId, extractedPlayerId);
                            if (ragnerResult && ragnerResult.success) {
                                await db.query(`UPDATE orders SET status='COMPLETED' WHERE id=$1`, [orderId]);
                                try {
                                    await ctx.telegram.editMessageText(scanningMsg.chat.id, scanningMsg.message_id, null, 
                                        "🎮 UC Delivered Successfully! (Payment auto-verified via OCR)", { parse_mode: "HTML" });
                                } catch(e) {}
                                await ctx.telegram.sendMessage(process.env.ADMIN_ID, 
                                    `✅ Order #${orderId} auto-completed (Cloud Vision OCR)\n` +
                                    `User: @${ctx.from.username || userId}\n` +
                                    `Product: ${product.name}\n` +
                                    `Amount: ${product.price} ETB\n` +
                                    `TX ID: ${extractedTxId}`
                                );
                            } else {
                                await db.query(`UPDATE orders SET status='APPROVED' WHERE id=$1`, [orderId]);
                                try {
                                    await ctx.telegram.editMessageText(scanningMsg.chat.id, scanningMsg.message_id, null, 
                                        "✅ Payment verified!\n\nAuto-delivery failed. Our team will complete your order shortly.", { parse_mode: "HTML" });
                                } catch(e) {}
                                
                                // Send admin notification for manual delivery
                                let adminMsg = `🟡 Order #${orderId} payment verified but auto-delivery failed\n👤 User: @${ctx.from.username || userId}\n📦 Product: ${product.name}\n💰 Amount: ${product.price} ETB\nTransaction ID: ${extractedTxId}\n`;
                                if (extractedPlayerId) adminMsg += `\n🎮 Player ID: ${extractedPlayerId}\n`;
                                if (extractedPlayerName) adminMsg += `👤 Player Name: ${extractedPlayerName}\n`;
                                adminMsg += `\n👇 Click "Complete" after manual delivery.`;
                                
                                await ctx.telegram.sendMessage(process.env.ADMIN_ID, adminMsg, {
                                    reply_markup: { inline_keyboard: [[{ text: "🎮 Complete Delivery", callback_data: `complete_${orderId}` }]] }
                                });
                            }
                        } catch(ragnerError) {
                            await db.query(`UPDATE orders SET status='APPROVED' WHERE id=$1`, [orderId]);
                            try {
                                await ctx.telegram.editMessageText(scanningMsg.chat.id, scanningMsg.message_id, null, 
                                    "✅ Payment verified!\n\nYour order has been approved. You will be notified when delivered.", { parse_mode: "HTML" });
                            } catch(e) {}
                            
                            // Send admin notification
                            let adminMsg = `🟡 Order #${orderId} payment verified (Ragner error)\n👤 User: @${ctx.from.username || userId}\n📦 Product: ${product.name}\n💰 Amount: ${product.price} ETB\nTransaction ID: ${extractedTxId}\n`;
                            if (extractedPlayerId) adminMsg += `\n🎮 Player ID: ${extractedPlayerId}\n`;
                            if (extractedPlayerName) adminMsg += `👤 Player Name: ${extractedPlayerName}\n`;
                            adminMsg += `\n⚠️ Ragner error: ${ragnerError.message}\n👇 Click "Complete" after manual delivery.`;
                            
                            await ctx.telegram.sendMessage(process.env.ADMIN_ID, adminMsg, {
                                reply_markup: { inline_keyboard: [[{ text: "🎮 Complete Delivery", callback_data: `complete_${orderId}` }]] }
                            });
                        }
                    } else {
                        // Manual product - auto approved
                        await db.query(`UPDATE orders SET status='APPROVED' WHERE id=$1`, [orderId]);
                        try {
                            await ctx.telegram.editMessageText(scanningMsg.chat.id, scanningMsg.message_id, null, 
                                "✅ Payment verified!\n\nYour order has been approved. You will be notified when delivered.", { parse_mode: "HTML" });
                        } catch(e) {}
                        
                        // Send admin notification with Player ID/Name
                        let adminMsg = `✅ Order #${orderId} automatically approved (ShegerPay verified)\n👤 User: @${ctx.from.username || userId}\n📦 Product: ${product.name}\n💰 Amount: ${product.price} ETB\nTransaction ID: ${extractedTxId}\n`;
                        if (extractedPlayerId) {
                            adminMsg += `\n🎮 Player ID: ${extractedPlayerId}\n`;
                            if (extractedPlayerName) adminMsg += `👤 Player Name: ${extractedPlayerName}\n`;
                        }
                        adminMsg += `\n👇 Click "Complete" after manual delivery.`;
                        
                        await ctx.telegram.sendMessage(process.env.ADMIN_ID, adminMsg, {
                            reply_markup: { inline_keyboard: [[{ text: "🎮 Complete Delivery", callback_data: `complete_${orderId}` }]] }
                        });
                    }
                    
                    delete userState[userId];
                    setTimeout(() => showMainMenu(ctx), 3000);
                    return;
                } else {
                    // Verification failed - send to admin for manual review
                    try {
                        await ctx.telegram.editMessageText(scanningMsg.chat.id, scanningMsg.message_id, null, 
                            "⚠️ Could not verify automatically.\n\nYour order has been submitted for manual review. You will be notified when approved.", { parse_mode: "HTML" });
                    } catch(e) {
                        await ctx.reply("⚠️ Could not verify automatically.\n\nYour order has been submitted for manual review. You will be notified when approved.", { parse_mode: "HTML" });
                    }
                    
                    let adminCaption = `📥 NEW ORDER (Manual Review)\n\n` +
                        `👤 User: @${ctx.from.username || userId}\n` +
                        `📦 Product: ${product.name}\n` +
                        `💰 Amount: ${product.price} ETB\n` +
                        `🧾 Order ID: #${orderId}\n` +
                        `💳 Method: ${state.paymentMethod?.name || "Bank Transfer"}\n` +
                        `🔍 OCR TX ID: ${extractedTxId}\n` +
                        (provider === "boa" ? `🔗 BOA URL: ${finalTxId}\n` : '') +
                        `❌ Error: ${verification.error}\n`;

                    if (extractedPlayerId) {
                        adminCaption += `\n🎮 Player ID: ${extractedPlayerId}\n`;
                        if (extractedPlayerName) adminCaption += `👤 Player Name: ${extractedPlayerName}\n`;
                    }

                    adminCaption += `\nUse buttons below to manage:`;

                    await ctx.telegram.sendPhoto(process.env.ADMIN_ID, fileId, {
                        caption: adminCaption,
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "✅ Approve", callback_data: `approve_${orderId}` }, { text: "❌ Reject", callback_data: `reject_${orderId}` }],
                                [{ text: "🎮 Complete", callback_data: `complete_${orderId}` }],
                            ],
                        },
                    });
                    
                    delete userState[userId];
                    setTimeout(() => showMainMenu(ctx), 3000);
                    return;
                }
            } else {
                // No TX ID found - send to admin
                try {
                    await ctx.telegram.editMessageText(scanningMsg.chat.id, scanningMsg.message_id, null, 
                        "⚠️ Could not read transaction ID from image.\n\nYour order has been submitted for manual review. You will be notified when approved.", { parse_mode: "HTML" });
                } catch(e) {}
                
                let adminCaption = `📥 NEW ORDER (Manual Review - Couldn't read TX ID)\n\n` +
                    `👤 User: @${ctx.from.username || userId}\n` +
                    `📦 Product: ${product.name}\n` +
                    `💰 Amount: ${product.price} ETB\n` +
                    `🧾 Order ID: #${orderId}\n` +
                    `💳 Method: ${state.paymentMethod?.name || "Bank Transfer"}\n`;
                
                if (extractedPlayerId) {
                    adminCaption += `\n🎮 Player ID: ${extractedPlayerId}\n`;
                    if (extractedPlayerName) adminCaption += `👤 Player Name: ${extractedPlayerName}\n`;
                }
                
                adminCaption += `\nUse buttons below to manage:`;
                
                await ctx.telegram.sendPhoto(process.env.ADMIN_ID, fileId, {
                    caption: adminCaption,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "✅ Approve", callback_data: `approve_${orderId}` }, { text: "❌ Reject", callback_data: `reject_${orderId}` }],
                            [{ text: "🎮 Complete", callback_data: `complete_${orderId}` }],
                        ],
                    },
                });
                
                delete userState[userId];
                setTimeout(() => showMainMenu(ctx), 3000);
                return;
            }
        }
        
        console.log("❌ Unhandled state in photo handler");
        await ctx.reply("⚠️ Something went wrong. Please start over with /start", { parse_mode: "HTML" });
        delete userState[userId];
    } catch (error) {
        console.error("❌ Payment screenshot error:", error);
        await ctx.reply("❌ Error processing payment. Please try again or contact support.", { parse_mode: "HTML" });
    }
});

module.exports = bot;