const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const categoryRoutes = require("./routes/category.routes");
const productRoutes = require("./routes/product.routes");
const orderRoutes = require("./routes/order.routes");
const settingsRoutes = require("./routes/settings.routes");
const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const giveawayRoutes = require("./routes/giveaway.routes");
const webhookRoutes = require("./routes/webhook.routes");

const app = express();

app.use(cors());

// IMPORTANT: ShegerPay webhook needs RAW body for signature verification
// This must come BEFORE express.json()
app.use("/webhook/shegerpay", express.raw({ type: "application/json" }), (req, res, next) => {
    req.rawBody = req.body.toString();
    // Parse the body back to JSON for easy use
    req.body = JSON.parse(req.body.toString());
    next();
});

// Regular JSON middleware for other routes
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Webhook routes (no authentication)
app.use("/webhook", webhookRoutes);

// Public routes
app.use("/api/auth", authRoutes);

// Auth middleware for protected routes
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "natan_topup_secret_key_2024");
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: "Invalid token" });
    }
};

// Protected routes
app.use("/api/categories", authMiddleware, categoryRoutes);
app.use("/api/products", authMiddleware, productRoutes);
app.use("/api/orders", authMiddleware, orderRoutes);
app.use("/api/settings", authMiddleware, settingsRoutes);
app.use("/api/users", authMiddleware, usersRoutes);
app.use("/api/giveaway", authMiddleware, giveawayRoutes);

// Telegram webhook (keep this at the end)
app.post("/webhook", (req, res) => {
    const bot = require("../bot/bot");
    bot.handleUpdate(req.body, res);
});

module.exports = app;