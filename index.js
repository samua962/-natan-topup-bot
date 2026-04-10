require("dotenv").config();
const path = require("path");
const express = require("express");
const bot = require("./bot/bot");
const adminApp = require("./admin/server");

const PORT = process.env.PORT || 5000;

// Serve static files from React build
const reactBuildPath = path.join(__dirname, "admin-dashboard", "build");

// Check if build exists
const fs = require("fs");
if (fs.existsSync(reactBuildPath)) {
    console.log("✅ React build found at:", reactBuildPath);
    adminApp.use(express.static(reactBuildPath));
    
    // Serve index.html for all non-API routes - FIXED: Use regex or function instead of "*"
    adminApp.get(/^\/(?!api|webhook).*/, (req, res) => {
        res.sendFile(path.join(reactBuildPath, "index.html"));
    });
} else {
    console.log("⚠️ React build not found at:", reactBuildPath);
    console.log("Make sure to run: cd admin-dashboard && npm run build");
}

// Start express
adminApp.listen(PORT, () => {
    console.log("Admin API running on port", PORT);
});

// Start bot with webhook
const WEBHOOK_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webhook`
  : null;

if (WEBHOOK_URL) {
    bot.telegram.setWebhook(WEBHOOK_URL);
    console.log("Webhook set to:", WEBHOOK_URL);
} else {
    bot.launch();
    console.log("Bot started with polling");
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));