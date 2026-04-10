const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../../database/db");

const JWT_SECRET = process.env.JWT_SECRET || "natan_topup_secret_key_2024";

// LOGIN
router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
    }
    
    try {
        const result = await db.query(
            "SELECT * FROM admin_users WHERE username = $1",
            [username.toLowerCase()]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        
        const admin = result.rows[0];
        const isValid = await bcrypt.compare(password, admin.password);
        
        if (!isValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        
        await db.query(
            "UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
            [admin.id]
        );
        
        const token = jwt.sign(
            { id: admin.id, username: admin.username },
            JWT_SECRET,
            { expiresIn: "24h" }
        );
        
        res.json({
            success: true,
            token,
            user: { id: admin.id, username: admin.username }
        });
        
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Login failed" });
    }
});

// VERIFY TOKEN
router.post("/verify", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
        return res.status(401).json({ error: "No token provided", valid: false });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const result = await db.query(
            "SELECT id, username FROM admin_users WHERE id = $1",
            [decoded.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "User not found", valid: false });
        }
        
        res.json({ valid: true, user: result.rows[0] });
    } catch (error) {
        res.status(401).json({ error: "Invalid token", valid: false });
    }
});

// CHANGE PASSWORD
router.post("/change-password", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    const { currentPassword, newPassword } = req.body;
    
    if (!token) {
        return res.status(401).json({ error: "No token provided" });
    }
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password required" });
    }
    
    if (newPassword.length < 4) {
        return res.status(400).json({ error: "New password must be at least 4 characters" });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const result = await db.query(
            "SELECT * FROM admin_users WHERE id = $1",
            [decoded.id]
        );
        
        const admin = result.rows[0];
        const isValid = await bcrypt.compare(currentPassword, admin.password);
        
        if (!isValid) {
            return res.status(401).json({ error: "Current password is incorrect" });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query(
            "UPDATE admin_users SET password = $1 WHERE id = $2",
            [hashedPassword, decoded.id]
        );
        
        res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ error: "Failed to change password" });
    }
});

// CHANGE USERNAME
router.post("/change-username", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    const { newUsername } = req.body;
    
    if (!token) {
        return res.status(401).json({ error: "No token provided" });
    }
    
    if (!newUsername || newUsername.length < 3) {
        return res.status(400).json({ error: "Username must be at least 3 characters" });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if username already exists
        const existing = await db.query(
            "SELECT id FROM admin_users WHERE username = $1 AND id != $2",
            [newUsername.toLowerCase(), decoded.id]
        );
        
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: "Username already taken" });
        }
        
        await db.query(
            "UPDATE admin_users SET username = $1 WHERE id = $2",
            [newUsername.toLowerCase(), decoded.id]
        );
        
        // Generate new token with new username
        const newToken = jwt.sign(
            { id: decoded.id, username: newUsername.toLowerCase() },
            JWT_SECRET,
            { expiresIn: "24h" }
        );
        
        res.json({ 
            success: true, 
            message: "Username changed successfully",
            token: newToken,
            username: newUsername.toLowerCase()
        });
    } catch (error) {
        console.error("Change username error:", error);
        res.status(500).json({ error: "Failed to change username" });
    }
});

// GET PROFILE
router.get("/profile", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
        return res.status(401).json({ error: "No token provided" });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const result = await db.query(
            "SELECT id, username, created_at, last_login FROM admin_users WHERE id = $1",
            [decoded.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "User not found" });
        }
        
        res.json({ success: true, profile: result.rows[0] });
    } catch (error) {
        res.status(401).json({ error: "Invalid token" });
    }
});

module.exports = router;