const axios = require("axios");

const BASE_URL = "https://ragnergiftcard.com/api/v1";

const headers = {
    "X-API-KEY": process.env.RAGNER_API_KEY,
    "Content-Type": "application/json"
};

const GENERIC_PRODUCT_ID = 1;

// Cache for valid product ID
let cachedProductId = null;
let cacheExpiry = 0;

async function getValidProductId() {
    // Return cached ID if still valid
    if (cachedProductId && Date.now() < cacheExpiry) {
        return cachedProductId;
    }

    try {
        const res = await axios.get(
            `${BASE_URL}/products?game=PUBG`,
            { headers, timeout: 10000 }
        );
        
        if (res.data?.data && res.data.data.length > 0) {
            cachedProductId = res.data.data[0].id;
            cacheExpiry = Date.now() + (5 * 60 * 1000); // Cache for 5 minutes
            return cachedProductId;
        }
    } catch (err) {
        console.error("Error fetching product ID:", err.message);
    }
    
    // Fallback to generic ID if fetch fails
    return GENERIC_PRODUCT_ID;
}

async function validatePlayerOnly(playerId) {
    try {
        const productId = await getValidProductId();
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