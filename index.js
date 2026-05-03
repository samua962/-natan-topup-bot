require("dotenv").config();
const path = require("path");
const express = require("express");
const bot = require("./bot/bot");
const adminApp = require("./admin/server");

const PORT = process.env.PORT || 5000;

// Middleware to preserve raw body for webhook signature verification
adminApp.use(express.json({
    verify: (req, res, buf, encoding) => {
        if (req.originalUrl === '/webhook/shegerpay') {
            req.rawBody = buf.toString();
        }
    }
}));

// Serve static files from React build
const reactBuildPath = path.join(__dirname, "admin-dashboard", "build");

const fs = require("fs");
if (fs.existsSync(reactBuildPath)) {
    console.log("✅ React build found at:", reactBuildPath);
    adminApp.use(express.static(reactBuildPath));
    
    adminApp.use((req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
            return next();
        }
        res.sendFile(path.join(reactBuildPath, "index.html"));
    });
} else {
    console.log("⚠️ React build not found at:", reactBuildPath);
}

// Start express
adminApp.listen(PORT, () => {
    console.log("Admin API running on port", PORT);
});

// Start bot with webhook
const WEBHOOK_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webhook/shegerpay`
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