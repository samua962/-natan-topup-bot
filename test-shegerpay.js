const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
require("dotenv").config();

async function testShegerPay() {
    const apiKey = process.env.SHEGERPAY_API_KEY;  
    if (!apiKey) {
        console.error("❌ SHEGERPAY_API_KEY not found in .env");
        return;
    }

    const imagePath = "./test-receipt.jpg";  
    if (!fs.existsSync(imagePath)) {
        console.error(`❌ Image not found at ${imagePath}`);
        return;
    }

    const form = new FormData();
    form.append("amount", "100");
    form.append("merchant_name", "Test Merchant");
    form.append("screenshot", fs.createReadStream(imagePath));

    try {
        const response = await axios.post("https://api.shegerpay.com/api/v1/verify-image", form, {
            headers: {
                ...form.getHeaders(),
                "X-API-Key": apiKey,
            },
            timeout: 15000,
        });
        console.log("✅ ShegerPay response:", JSON.stringify(response.data, null, 2));
        if (response.data.verified === true) {
            console.log("🎉 API key works! Auto‑verification should succeed.");
        } else {
            console.log("⚠️ API key works but verification failed (maybe image unclear).");
        }
    } catch (err) {
        console.error("❌ Error calling ShegerPay:");
        if (err.response) {
            console.error("Status:", err.response.status);
            console.error("Data:", err.response.data);
        } else {
            console.error(err.message);
        }
    }
}

testShegerPay();