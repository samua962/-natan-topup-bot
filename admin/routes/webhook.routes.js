const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const db = require("../../database/db");

// Helper: verify webhook signature
function verifyWebhookSignature(body, signatureHeader, secret) {
    if (!signatureHeader || !secret) return false;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const provided = signatureHeader.replace('sha256=', '');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

// Helper: get pending deposit by transaction ID
async function findPendingDepositByTxId(txId) {
    const result = await db.query(
        "SELECT * FROM deposit_requests WHERE transaction_id = $1 AND status = 'PENDING'",
        [txId]
    );
    return result.rows[0] || null;
}

// Helper: get pending order by transaction ID
async function findPendingOrderByTxId(txId) {
    const result = await db.query(
        "SELECT * FROM orders WHERE transaction_id = $1 AND status = 'PENDING' AND payment_method = 'bank_transfer'",
        [txId]
    );
    return result.rows[0] || null;
}

// Helper: update wallet balance
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

// ShegerPay webhook endpoint
router.post("/shegerpay", async (req, res) => {
    // Get the raw body (set by middleware in server.js)
    const rawBody = req.rawBody;
    const signature = req.headers["x-shegerpay-signature"];
    const event = req.headers["x-shegerpay-event"];
    const data = req.body.data || req.body;
    
    console.log("📨 ShegerPay webhook received:", { event, signature: signature ? "present" : "missing" });
    
    // Get webhook secret from database
    const secretResult = await db.query("SELECT value FROM settings WHERE key='shegerpay_webhook_secret'");
    const secret = secretResult.rows[0]?.value;
    
    // Verify signature (if secret exists)
    if (secret && signature) {
        const isValid = verifyWebhookSignature(rawBody, signature, secret);
        if (!isValid) {
            console.error("❌ Invalid webhook signature");
            return res.status(401).json({ error: "Invalid signature" });
        }
        console.log("✅ Signature verified");
    } else if (secret && !signature) {
        console.warn("⚠️ Webhook secret configured but no signature header received");
    } else {
        console.warn("⚠️ No webhook secret configured – skipping signature verification");
    }
    
    // Handle payment.verified event
    if (event === "payment.verified") {
        const txId = data.transaction_id;
        const amount = parseFloat(data.amount);
        const provider = data.provider;
        
        console.log(`💰 Payment verified: TX ${txId}, Amount ${amount}, Provider ${provider}`);
        
        // Check if it's a deposit request
        const pendingDeposit = await findPendingDepositByTxId(txId);
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
            
            // Import bot dynamically to avoid circular dependency
            const bot = require("../../bot/bot");
            
            try {
                await bot.telegram.sendMessage(
                    pendingDeposit.telegram_id,
                    `✅ DEPOSIT APPROVED!\n\n💰 Amount: ${pendingDeposit.amount} ETB has been added to your wallet.\n\nThank you for using Natan Top Up!`
                );
            } catch (err) {
                console.error("Failed to notify user:", err.message);
            }
            
            try {
                await bot.telegram.sendMessage(
                    process.env.ADMIN_ID,
                    `✅ AUTO-VERIFIED DEPOSIT (Webhook)\n\n👤 User ID: ${pendingDeposit.telegram_id}\n💰 Amount: ${pendingDeposit.amount} ETB\n🧾 Transaction ID: ${txId}\n💳 Provider: ${provider}`
                );
            } catch (err) {
                console.error("Failed to notify admin:", err.message);
            }
            
            return res.status(200).json({ success: true, message: "Deposit approved via webhook" });
        }
        
        // Check if it's an order payment
        const pendingOrder = await findPendingOrderByTxId(txId);
        if (pendingOrder) {
            console.log(`✅ Found pending order #${pendingOrder.id}`);
            
            const isInstant = pendingOrder.delivery_type === "ragner" || pendingOrder.product_type === "uc_instant";
            const bot = require("../../bot/bot");
            
            if (isInstant) {
                const { createOrder } = require("../../services/ragner");
                const ragnerResult = await createOrder(pendingOrder.external_product_id, pendingOrder.player_id);
                
                if (ragnerResult && ragnerResult.success) {
                    await db.query(
                        `UPDATE orders SET status = 'COMPLETED', verified_by_shegerpay = true WHERE id = $1`,
                        [pendingOrder.id]
                    );
                    
                    try {
                        await bot.telegram.sendMessage(
                            pendingOrder.telegram_id,
                            `🎮 UC Delivered Successfully! (Payment auto-verified)\n\n📦 Product: ${pendingOrder.product_name}\n💰 Amount: ${pendingOrder.price_etb} ETB`
                        );
                    } catch (err) {
                        console.error("Failed to notify user:", err.message);
                    }
                    
                    try {
                        await bot.telegram.sendMessage(
                            process.env.ADMIN_ID,
                            `✅ ORDER AUTO-COMPLETED (Webhook)\n\n👤 User ID: ${pendingOrder.telegram_id}\n📦 Product: ${pendingOrder.product_name}\n💰 Amount: ${pendingOrder.price_etb} ETB\n🧾 Transaction ID: ${txId}\n🎮 Auto-delivered via Ragner`
                        );
                    } catch (err) {
                        console.error("Failed to notify admin:", err.message);
                    }
                } else {
                    await db.query(
                        `UPDATE orders SET status = 'APPROVED', verified_by_shegerpay = true WHERE id = $1`,
                        [pendingOrder.id]
                    );
                    
                    try {
                        await bot.telegram.sendMessage(
                            pendingOrder.telegram_id,
                            `✅ Payment verified! Delivery in progress. You will be notified when completed.`
                        );
                    } catch (err) {
                        console.error("Failed to notify user:", err.message);
                    }
                    
                    try {
                        await bot.telegram.sendMessage(
                            process.env.ADMIN_ID,
                            `🟡 ORDER AUTO-APPROVED (Webhook) – Delivery failed\n\n👤 User ID: ${pendingOrder.telegram_id}\n📦 Product: ${pendingOrder.product_name}\n💰 Amount: ${pendingOrder.price_etb} ETB\n🧾 Transaction ID: ${txId}\n⚠️ Auto-delivery failed – please complete manually`,
                            {
                                reply_markup: {
                                    inline_keyboard: [[{ text: "🎮 Complete Delivery", callback_data: `complete_${pendingOrder.id}` }]]
                                }
                            }
                        );
                    } catch (err) {
                        console.error("Failed to notify admin:", err.message);
                    }
                }
            } else {
                await db.query(
                    `UPDATE orders SET status = 'APPROVED', verified_by_shegerpay = true WHERE id = $1`,
                    [pendingOrder.id]
                );
                
                try {
                    await bot.telegram.sendMessage(
                        pendingOrder.telegram_id,
                        `✅ Payment verified! Your order has been approved. You will be notified when delivered.`
                    );
                } catch (err) {
                    console.error("Failed to notify user:", err.message);
                }
                
                let adminMsg = `✅ ORDER AUTO-APPROVED (Webhook)\n\n👤 User ID: ${pendingOrder.telegram_id}\n📦 Product: ${pendingOrder.product_name}\n💰 Amount: ${pendingOrder.price_etb} ETB\n🧾 Transaction ID: ${txId}\n\n👇 Click "Complete" after manual delivery.`;
                
                if (pendingOrder.user_inputs) {
                    const inputs = typeof pendingOrder.user_inputs === 'string' 
                        ? JSON.parse(pendingOrder.user_inputs) 
                        : pendingOrder.user_inputs;
                    if (inputs.player_id) adminMsg += `\n🎮 Player ID: ${inputs.player_id}`;
                    if (inputs.email) adminMsg += `\n📧 Email: ${inputs.email}`;
                    if (inputs.phone) adminMsg += `\n📱 Phone: ${inputs.phone}`;
                    if (inputs.username) adminMsg += `\n👤 Username: ${inputs.username}`;
                }
                
                try {
                    await bot.telegram.sendPhoto(
                        process.env.ADMIN_ID,
                        pendingOrder.payment_file_id,
                        {
                            caption: adminMsg,
                            reply_markup: {
                                inline_keyboard: [[{ text: "🎮 Complete Delivery", callback_data: `complete_${pendingOrder.id}` }]]
                            }
                        }
                    );
                } catch (err) {
                    console.error("Failed to send admin photo:", err.message);
                }
            }
            
            return res.status(200).json({ success: true, message: "Order approved via webhook" });
        }
        
        console.log(`⚠️ No pending deposit or order found for TX ${txId}`);
        return res.status(200).json({ success: false, message: "No pending transaction found" });
    }
    
    // Handle payment.failed event
    if (event === "payment.failed") {
        const txId = data.transaction_id;
        console.log(`❌ Payment failed: TX ${txId}, Reason: ${data.reason || "Unknown"}`);
        
        const bot = require("../../bot/bot");
        try {
            await bot.telegram.sendMessage(
                process.env.ADMIN_ID,
                `❌ PAYMENT FAILED (Webhook)\n\n🧾 Transaction ID: ${txId}\n📝 Reason: ${data.reason || "Unknown"}\n💳 Provider: ${data.provider || "Unknown"}`
            );
        } catch (err) {
            console.error("Failed to notify admin:", err.message);
        }
        
        return res.status(200).json({ success: true, message: "Payment failure logged" });
    }
    
    console.log(`ℹ️ Unhandled webhook event: ${event}`);
    return res.status(200).json({ success: true, message: "Event received but not processed" });
});

module.exports = router;