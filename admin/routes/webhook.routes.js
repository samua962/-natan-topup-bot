const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const db = require("../../database/db");

// =====================
// 🟢 CONFIGURATION
// =====================
const WEBHOOK_DEBUG = process.env.WEBHOOK_DEBUG === 'true';

// =====================
// 🟢 HELPER: DEBUG LOGGING
// =====================
function debugLog(message, data = {}) {
    if (WEBHOOK_DEBUG) {
        const sanitizedData = { ...data };
        delete sanitizedData.secret;
        delete sanitizedData.signature;
        delete sanitizedData.rawBody;
        console.log(`[WEBHOOK DEBUG] ${message}`, JSON.stringify(sanitizedData, null, 2));
    }
}

// =====================
// 🟢 HELPER: GET WEBHOOK SECRET
// =====================
async function getWebhookSecret() {
    const result = await db.query(
        "SELECT value FROM settings WHERE key='shegerpay_webhook_secret'"
    );
    return result.rows[0]?.value || null;
}

// =====================
// 🟢 HELPER: VERIFY WEBHOOK SIGNATURE
// =====================
function verifyWebhookSignature(body, signatureHeader, secret) {
    if (!signatureHeader || !secret) {
        console.log("❌ Missing signature or secret");
        return false;
    }
    
    // ShegerPay sends: sha256=<hmac_hex_digest>
    const provided = signatureHeader.replace('sha256=', '').trim();
    
    if (!/^[0-9a-f]{64}$/i.test(provided)) {
        console.error("❌ Invalid signature format:", provided.substring(0, 20) + "...");
        return false;
    }
    
    // Create expected signature (hex digest as per ShegerPay docs)
    const expected = crypto
        .createHmac('sha256', secret)
        .update(body, 'utf8')
        .digest('hex');
    
    // Debug logging (remove in production)
    console.log("🔐 Signature verification debug:");
    console.log("   Body length:", body.length);
    console.log("   Body preview:", body.substring(0, 100) + "...");
    console.log("   Expected:", expected);
    console.log("   Provided:", provided);
    console.log("   Match:", expected === provided);
    
    // Use timing-safe comparison
    try {
        return crypto.timingSafeEqual(
            Buffer.from(expected),
            Buffer.from(provided)
        );
    } catch (err) {
        console.error("❌ Signature comparison error:", err.message);
        return false;
    }
}

// =====================
// 🟢 HELPER: CHECK DUPLICATE DELIVERY
// =====================
async function isDuplicateDelivery(deliveryId) {
    if (!deliveryId) return false;
    const result = await db.query(
        "SELECT id FROM webhook_deliveries WHERE delivery_id = $1 AND processed = true",
        [deliveryId]
    );
    return result.rows.length > 0;
}

// =====================
// 🟢 HELPER: LOG WEBHOOK DELIVERY
// =====================
async function logWebhookDelivery(event, deliveryId, signatureValid, payload, processed, errorMessage, processingTimeMs) {
    try {
        await db.query(
            `INSERT INTO webhook_deliveries 
            (event_type, delivery_id, signature_valid, payload, processed, error_message, processing_time_ms)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                event,
                deliveryId,
                signatureValid,
                JSON.stringify(payload),
                processed,
                errorMessage,
                processingTimeMs
            ]
        );
    } catch (err) {
        console.error('Failed to log webhook delivery:', err.message);
    }
}

// =====================
// 🟢 HELPER: FIND PENDING DEPOSIT
// =====================
async function findPendingDepositByTxId(txId, amount, provider) {
    // Exact match first
    let result = await db.query(
        "SELECT * FROM deposit_requests WHERE transaction_id = $1 AND status = 'PENDING'",
        [txId]
    );
    if (result.rows[0]) return result.rows[0];
    
    // If no exact match, try matching by amount and recent deposits
    if (amount) {
        result = await db.query(
            `SELECT * FROM deposit_requests 
             WHERE status = 'PENDING' 
             AND amount = $1 
             AND payment_method ILIKE $2
             AND created_at > NOW() - INTERVAL '30 minutes'
             ORDER BY created_at DESC 
             LIMIT 1`,
            [amount, `%${provider}%`]
        );
        
        if (result.rows[0]) {
            // Update the transaction_id for future reference
            await db.query(
                "UPDATE deposit_requests SET transaction_id = $1 WHERE id = $2",
                [txId, result.rows[0].id]
            );
            return result.rows[0];
        }
    }
    
    return null;
}

// =====================
// 🟢 HELPER: FIND PENDING ORDER
// =====================
async function findPendingOrderByTxId(txId, amount, provider) {
    // Exact match first
    let result = await db.query(
        "SELECT * FROM orders WHERE transaction_id = $1 AND status = 'PENDING' AND payment_method = 'bank_transfer'",
        [txId]
    );
    if (result.rows[0]) return result.rows[0];
    
    // If no exact match, try matching by amount and recent orders
    if (amount) {
        result = await db.query(
            `SELECT * FROM orders 
             WHERE status = 'PENDING' 
             AND payment_method = 'bank_transfer'
             AND price_etb = $1 
             AND created_at > NOW() - INTERVAL '30 minutes'
             ORDER BY created_at DESC 
             LIMIT 1`,
            [amount]
        );
        
        if (result.rows[0]) {
            // Update the transaction_id for future reference
            await db.query(
                "UPDATE orders SET transaction_id = $1 WHERE id = $2",
                [txId, result.rows[0].id]
            );
            return result.rows[0];
        }
    }
    
    return null;
}

// =====================
// 🟢 HELPER: UPDATE WALLET BALANCE
// =====================
async function updateWalletBalance(telegramId, amount, type, referenceId, description) {
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        
        let wallet = await client.query(
            "SELECT balance FROM user_wallets WHERE telegram_id = $1",
            [telegramId]
        );
        if (wallet.rows.length === 0) {
            await client.query(
                "INSERT INTO user_wallets (telegram_id, balance) VALUES ($1, 0)",
                [telegramId]
            );
            wallet = { rows: [{ balance: 0 }] };
        }
        
        const oldBalance = parseFloat(wallet.rows[0].balance);
        const newBalance = type === "DEPOSIT" ? oldBalance + amount : oldBalance - amount;
        
        await client.query(
            "UPDATE user_wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = $2",
            [newBalance, telegramId]
        );
        
        await client.query(
            `INSERT INTO transaction_history 
            (telegram_id, type, amount, balance_before, balance_after, reference_id, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [telegramId, type, amount, oldBalance, newBalance, referenceId, description]
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

// =====================
// 🟢 HELPER: GET BOT INSTANCE (SAFELY)
// =====================
async function getBot() {
    try {
        return require("../../bot/bot");
    } catch (err) {
        console.error("Failed to load bot module:", err.message);
        return null;
    }
}

// =====================
// 🟢 HELPER: PARSE USER INPUTS
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

// =====================
// 🟢 HANDLER: PAYMENT VERIFIED
// =====================
async function handlePaymentVerified(data, deliveryId) {
    const txId = data.transaction_id;
    const amount = parseFloat(data.amount);
    const provider = data.provider;
    
    console.log(`💰 Processing payment.verified webhook: TX ${txId}, Amount ${amount}, Provider ${provider}`);
    
    // Check if it's a deposit request
    const pendingDeposit = await findPendingDepositByTxId(txId, amount, provider);
    if (pendingDeposit) {
        console.log(`✅ Found pending deposit #${pendingDeposit.id}`);
        
        await db.query(
            `UPDATE deposit_requests 
             SET status = 'APPROVED', processed_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [pendingDeposit.id]
        );
        
        await updateWalletBalance(
            pendingDeposit.telegram_id,
            pendingDeposit.amount,
            "DEPOSIT",
            pendingDeposit.id,
            `Deposit of ${pendingDeposit.amount} ETB (Auto-verified via webhook, TX: ${txId})`
        );
        
        const bot = await getBot();
        if (bot) {
            // Notify user
            try {
                await bot.telegram.sendMessage(
                    pendingDeposit.telegram_id,
                    `✅ DEPOSIT APPROVED!\n\n` +
                    `💰 Amount: ${pendingDeposit.amount} ETB has been added to your wallet.\n\n` +
                    `Thank you for using Natan Top Up!`
                );
            } catch (err) {
                console.error("Failed to notify user:", err.message);
            }
            
            // Notify admin
            try {
                await bot.telegram.sendMessage(
                    process.env.ADMIN_ID,
                    `✅ AUTO-VERIFIED DEPOSIT (Webhook)\n\n` +
                    `👤 User ID: ${pendingDeposit.telegram_id}\n` +
                    `💰 Amount: ${pendingDeposit.amount} ETB\n` +
                    `🧾 Transaction ID: ${txId}\n` +
                    `💳 Provider: ${provider}\n` +
                    `🔑 Delivery ID: ${deliveryId || 'N/A'}`
                );
            } catch (err) {
                console.error("Failed to notify admin:", err.message);
            }
        }
        
        return true;
    }
    
    // Check if it's an order payment
    const pendingOrder = await findPendingOrderByTxId(txId, amount, provider);
    if (pendingOrder) {
        console.log(`✅ Found pending order #${pendingOrder.id}`);
        
        const isInstant = pendingOrder.delivery_type === "ragner" || 
                         (pendingOrder.external_product_id && pendingOrder.delivery_type === "ragner");
        
        const bot = await getBot();
        
        if (isInstant) {
            let ragnerDelivered = false;
            
            // Try Ragner delivery if service is available
            try {
                const { createOrder } = require("../../services/ragner");
                const ragnerResult = await createOrder(
                    pendingOrder.external_product_id, 
                    pendingOrder.player_id
                );
                
                if (ragnerResult && ragnerResult.success) {
                    ragnerDelivered = true;
                    await db.query(
                        `UPDATE orders SET status = 'COMPLETED', verified_by_shegerpay = true WHERE id = $1`,
                        [pendingOrder.id]
                    );
                    
                    if (bot) {
                        try {
                            await bot.telegram.sendMessage(
                                pendingOrder.telegram_id,
                                `🎮 UC Delivered Successfully! (Payment auto-verified)\n\n` +
                                `📦 Product: ${pendingOrder.product_name}\n` +
                                `💰 Amount: ${pendingOrder.price_etb} ETB`
                            );
                        } catch (err) {
                            console.error("Failed to notify user:", err.message);
                        }
                        
                        try {
                            await bot.telegram.sendMessage(
                                process.env.ADMIN_ID,
                                `✅ ORDER AUTO-COMPLETED (Webhook)\n\n` +
                                `👤 User ID: ${pendingOrder.telegram_id}\n` +
                                `📦 Product: ${pendingOrder.product_name}\n` +
                                `💰 Amount: ${pendingOrder.price_etb} ETB\n` +
                                `🧾 Transaction ID: ${txId}\n` +
                                `🎮 Auto-delivered via Ragner\n` +
                                `🔑 Delivery ID: ${deliveryId || 'N/A'}`
                            );
                        } catch (err) {
                            console.error("Failed to notify admin:", err.message);
                        }
                    }
                }
            } catch (ragnerError) {
                console.error("Ragner delivery failed:", ragnerError.message);
                // Fall through to manual approval
            }
            
            if (!ragnerDelivered) {
                // Mark as approved, requires manual delivery
                await db.query(
                    `UPDATE orders SET status = 'APPROVED', verified_by_shegerpay = true WHERE id = $1`,
                    [pendingOrder.id]
                );
                
                if (bot) {
                    try {
                        await bot.telegram.sendMessage(
                            pendingOrder.telegram_id,
                            `✅ Payment verified!\n\n` +
                            `Your order has been approved. ` +
                            `Delivery will be completed shortly. You will be notified when done.`
                        );
                    } catch (err) {
                        console.error("Failed to notify user:", err.message);
                    }
                    
                    try {
                        await bot.telegram.sendMessage(
                            process.env.ADMIN_ID,
                            `🟡 ORDER AUTO-APPROVED (Webhook) – Needs Manual Delivery\n\n` +
                            `👤 User ID: ${pendingOrder.telegram_id}\n` +
                            `📦 Product: ${pendingOrder.product_name}\n` +
                            `💰 Amount: ${pendingOrder.price_etb} ETB\n` +
                            `🧾 Transaction ID: ${txId}\n` +
                            `⚠️ Auto-delivery failed – please complete manually\n` +
                            `🔑 Delivery ID: ${deliveryId || 'N/A'}`,
                            {
                                reply_markup: {
                                    inline_keyboard: [[{ 
                                        text: "🎮 Complete Delivery", 
                                        callback_data: `complete_${pendingOrder.id}` 
                                    }]]
                                }
                            }
                        );
                    } catch (err) {
                        console.error("Failed to notify admin:", err.message);
                    }
                }
            }
        } else {
            // Manual product - mark as approved
            await db.query(
                `UPDATE orders SET status = 'APPROVED', verified_by_shegerpay = true WHERE id = $1`,
                [pendingOrder.id]
            );
            
            if (bot) {
                try {
                    await bot.telegram.sendMessage(
                        pendingOrder.telegram_id,
                        `✅ Payment verified!\n\n` +
                        `Your order has been approved. ` +
                        `You will be notified when delivered.`
                    );
                } catch (err) {
                    console.error("Failed to notify user:", err.message);
                }
                
                let adminMsg = `✅ ORDER AUTO-APPROVED (Webhook)\n\n` +
                    `👤 User ID: ${pendingOrder.telegram_id}\n` +
                    `📦 Product: ${pendingOrder.product_name}\n` +
                    `💰 Amount: ${pendingOrder.price_etb} ETB\n` +
                    `🧾 Transaction ID: ${txId}\n\n` +
                    `👇 Click "Complete" after manual delivery.`;
                
                if (pendingOrder.user_inputs) {
                    const inputs = parseUserInputs(pendingOrder.user_inputs);
                    if (inputs) {
                        if (inputs.player_id) adminMsg += `\n🎮 Player ID: ${inputs.player_id}`;
                        if (inputs.email) adminMsg += `\n📧 Email: ${inputs.email}`;
                        if (inputs.phone) adminMsg += `\n📱 Phone: ${inputs.phone}`;
                        if (inputs.username) adminMsg += `\n👤 Username: ${inputs.username}`;
                        if (inputs.password) adminMsg += `\n🔐 Password: ${inputs.password}`;
                    }
                }
                
                if (pendingOrder.payment_file_id) {
                    try {
                        await bot.telegram.sendPhoto(
                            process.env.ADMIN_ID,
                            pendingOrder.payment_file_id,
                            {
                                caption: adminMsg,
                                reply_markup: {
                                    inline_keyboard: [[{ 
                                        text: "🎮 Complete Delivery", 
                                        callback_data: `complete_${pendingOrder.id}` 
                                    }]]
                                }
                            }
                        );
                    } catch (err) {
                        // Fallback to text if photo fails
                        try {
                            await bot.telegram.sendMessage(
                                process.env.ADMIN_ID,
                                adminMsg,
                                {
                                    reply_markup: {
                                        inline_keyboard: [[{ 
                                            text: "🎮 Complete Delivery", 
                                            callback_data: `complete_${pendingOrder.id}` 
                                        }]]
                                    }
                                }
                            );
                        } catch (err2) {
                            console.error("Failed to notify admin:", err2.message);
                        }
                    }
                } else {
                    try {
                        await bot.telegram.sendMessage(
                            process.env.ADMIN_ID,
                            adminMsg,
                            {
                                reply_markup: {
                                    inline_keyboard: [[{ 
                                        text: "🎮 Complete Delivery", 
                                        callback_data: `complete_${pendingOrder.id}` 
                                    }]]
                                }
                            }
                        );
                    } catch (err2) {
                        console.error("Failed to notify admin:", err2.message);
                    }
                }
            }
        }
        
        return true;
    }
    
    console.log(`⚠️ No pending deposit or order found for TX ${txId} (Amount: ${amount}, Provider: ${provider})`);
    return false;
}

// =====================
// 🟢 HANDLER: PAYMENT FAILED
// =====================
async function handlePaymentFailed(data) {
    const txId = data.transaction_id;
    const reason = data.reason || "Unknown";
    const provider = data.provider || "Unknown";
    
    console.log(`❌ Processing payment.failed webhook: TX ${txId}, Reason: ${reason}`);
    
    const bot = await getBot();
    if (bot) {
        try {
            await bot.telegram.sendMessage(
                process.env.ADMIN_ID,
                `❌ PAYMENT FAILED (Webhook)\n\n` +
                `🧾 Transaction ID: ${txId}\n` +
                `📝 Reason: ${reason}\n` +
                `💳 Provider: ${provider}`
            );
        } catch (err) {
            console.error("Failed to notify admin:", err.message);
        }
    }
    
    return true;
}

// =====================
// 🟢 WEBHOOK ENDPOINT
// =====================
router.post("/shegerpay", async (req, res) => {
    const startTime = Date.now();
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const signature = req.headers["x-shegerpay-signature"];
    const event = req.headers["x-shegerpay-event"];
    const deliveryId = req.headers["x-shegerpay-delivery-id"];
    const data = req.body.data || req.body;
    
    console.log("📨 ShegerPay webhook received:", {
        event,
        deliveryId: deliveryId || 'N/A',
        signature: signature ? "present" : "missing",
        hasBody: Boolean(rawBody)
    });
    
    debugLog("Webhook details", { 
        event, 
        deliveryId, 
        rawBody: rawBody?.substring(0, 500),
        data 
    });
    
    // 1. Check for duplicate delivery
    if (deliveryId && await isDuplicateDelivery(deliveryId)) {
        console.log(`⚠️ Duplicate webhook delivery: ${deliveryId}`);
        return res.status(200).json({ 
            success: true, 
            message: 'Already processed',
            deliveryId 
        });
    }
    
    // 2. Verify signature
    const secret = await getWebhookSecret();
    let signatureValid = false;
    
    if (secret) {
        if (signature) {
            signatureValid = verifyWebhookSignature(rawBody, signature, secret);
            if (signatureValid) {
                console.log("✅ Signature verified");
            } else {
                console.error("❌ Invalid webhook signature");
                await logWebhookDelivery(
                    event, deliveryId, false, data, false, 
                    'Invalid signature', Date.now() - startTime
                );
                return res.status(401).json({ error: "Invalid signature" });
            }
        } else {
            console.warn("⚠️ Webhook secret configured but no signature header received");
        }
    } else {
        console.warn("⚠️ No webhook secret configured – skipping signature verification");
    }
    
    // 3. Process based on event type
    let processed = false;
    let errorMessage = null;
    
    try {
        switch (event) {
            case "payment.verified":
                processed = await handlePaymentVerified(data, deliveryId);
                if (!processed) {
                    errorMessage = "No pending transaction found matching this payment";
                }
                break;
                
            case "payment.failed":
                processed = await handlePaymentFailed(data);
                break;
                
            default:
                console.log(`ℹ️ Unhandled webhook event: ${event}`);
                processed = true; // Acknowledge receipt even if not processed
        }
    } catch (error) {
        console.error("❌ Webhook processing error:", error);
        errorMessage = error.message;
        processed = false;
    }
    
    // 4. Log delivery
    const processingTime = Date.now() - startTime;
    await logWebhookDelivery(
        event, deliveryId, signatureValid, data, 
        processed, errorMessage, processingTime
    );
    
    // 5. Return response
    const statusCode = processed ? 200 : 500;
    res.status(statusCode).json({
        success: processed,
        message: processed ? "Webhook processed successfully" : (errorMessage || "Processing failed"),
        deliveryId,
        processingTimeMs: processingTime
    });
});

// =====================
// 🟢 HEALTH CHECK ENDPOINT
// =====================
router.get("/status", async (req, res) => {
    try {
        const secret = await getWebhookSecret();
        
        const recentDeliveries = await db.query(
            `SELECT event_type, signature_valid, processed, error_message, processing_time_ms, created_at 
             FROM webhook_deliveries 
             ORDER BY created_at DESC 
             LIMIT 10`
        );
        
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentStats = await db.query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN signature_valid THEN 1 ELSE 0 END) as valid_signatures,
                SUM(CASE WHEN processed THEN 1 ELSE 0 END) as processed_count,
                AVG(processing_time_ms) as avg_processing_time_ms
             FROM webhook_deliveries 
             WHERE created_at > $1`,
            [oneHourAgo]
        );
        
        res.json({
            configured: !!secret,
            hasSecret: !!secret,
            lastHour: {
                total: parseInt(recentStats.rows[0].total) || 0,
                validSignatures: parseInt(recentStats.rows[0].valid_signatures) || 0,
                processed: parseInt(recentStats.rows[0].processed_count) || 0,
                avgProcessingTimeMs: Math.round(recentStats.rows[0].avg_processing_time_ms) || 0
            },
            recentDeliveries: recentDeliveries.rows
        });
    } catch (error) {
        console.error("Status check error:", error);
        res.status(500).json({ error: error.message });
    }
});

// =====================
// 🟢 TEST ENDPOINT (Debug only - enable with env var)
// =====================
if (process.env.ENABLE_WEBHOOK_TEST === 'true') {
    router.post("/test", async (req, res) => {
        try {
            const testPayload = {
                data: {
                    transaction_id: req.body.transaction_id || 'TEST_TX_' + Date.now(),
                    provider: req.body.provider || 'cbe',
                    amount: req.body.amount || 500,
                    currency: 'ETB',
                    status: 'verified',
                    merchant_name: 'Natan Top Up',
                    verified_at: new Date().toISOString()
                }
            };
            
            console.log("🧪 Test webhook payload:", testPayload);
            
            const result = await handlePaymentVerified(testPayload.data, 'test_' + Date.now());
            
            res.json({ 
                success: true, 
                processed: result,
                testPayload: testPayload.data 
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}

module.exports = router;