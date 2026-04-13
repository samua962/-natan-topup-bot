const axios = require("axios");

const BASE_URL = "https://ragnergiftcard.com/api/v1";

const headers = {
    "X-API-KEY": process.env.RAGNER_API_KEY,
    "Content-Type": "application/json"
};

const GENERIC_PRODUCT_ID = 1;

async function validatePlayerOnly(playerId) {
    try {
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

async function createOrder(productId, playerId) {
    try {
        console.log(`Creating order - Product ID: ${productId}, Player ID: ${playerId}`);
        
        // First, validate the player
        const validation = await validatePlayer(productId, playerId);
        
        if (!validation || !validation.success) {
            console.log("Player validation failed before order");
            return {
                success: false,
                error: "Player validation failed. Please check Player ID.",
                details: validation
            };
        }
        
        // Then create the order
        const res = await axios.post(
            `${BASE_URL}/order`,
            {
                product_id: parseInt(productId),
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
        
        console.log("Ragner API Response:", JSON.stringify(res.data, null, 2));
        
        const isSuccess = 
            res.data?.success === true || 
            res.data?.status === "success" || 
            res.data?.status === "completed" ||
            res.data?.data?.status === "success" ||
            (res.data?.order_id && !res.data?.error);
        
        return {
            success: isSuccess,
            data: res.data,
            orderId: res.data?.order_id || res.data?.id || res.data?.data?.order_id
        };
    } catch (err) {
        console.error("Create order error:", err.response?.data || err.message);
        return {
            success: false,
            error: err.response?.data?.error?.message || err.message,
            details: err.response?.data
        };
    }
}

module.exports = {
    validatePlayer,
    validatePlayerOnly,
    createOrder
};