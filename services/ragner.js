const axios = require("axios");

const BASE_URL = "https://ragnergiftcard.com/api/v1";

const headers = {
    "X-API-KEY": process.env.RAGNER_API_KEY,
    "Content-Type": "application/json"
};

// Generic product ID for validation only (try 1, 100, or ask Ragner support)
const GENERIC_PRODUCT_ID = 1; // You may need to change this

// ✅ Validate Player WITHOUT Product ID (using generic ID)
async function validatePlayerOnly(playerId) {
    try {
        // Try with generic product ID
        const res = await axios.post(
            `${BASE_URL}/validate-player`,
            {
                product_id: GENERIC_PRODUCT_ID,
                player_id: playerId
            },
            { headers, timeout: 10000 }
        );
        return res.data;
    } catch (err) {
        console.error("Validation error:", err.response?.data || err.message);
        return null;
    }
}

// ✅ Validate Player WITH Product ID (for instant products)
async function validatePlayer(productId, playerId) {
    try {
        const res = await axios.post(
            `${BASE_URL}/validate-player`,
            {
                product_id: productId,
                player_id: playerId
            },
            { headers, timeout: 10000 }
        );
        return res.data;
    } catch (err) {
        console.error("Validation error:", err.response?.data || err.message);
        return null;
    }
}

// ✅ Create Order
async function createOrder(productId, playerId) {
    try {
        const res = await axios.post(
            `${BASE_URL}/order`,
            {
                product_id: productId,
                qty: 1,
                player_id: playerId
            },
            {
                headers: {
                    ...headers,
                    "X-Idempotency-Key": Date.now().toString()
                },
                timeout: 15000
            }
        );
        return res.data;
    } catch (err) {
        console.error("Create order error:", err.response?.data || err.message);
        return null;
    }
}

module.exports = {
    validatePlayer,
    validatePlayerOnly,
    createOrder
};