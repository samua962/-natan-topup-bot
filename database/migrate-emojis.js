#!/usr/bin/env node

/**
 * Emoji Migration Runner
 * Run this script to set up emoji system in the database
 * Usage: node database/migrate-emojis.js
 */

require("dotenv").config();
const db = require("./db");
const fs = require("fs");
const path = require("path");

async function runMigration(name, sqlFile) {
    try {
        console.log(`\n📋 Running migration: ${name}`);
        const sql = fs.readFileSync(path.join(__dirname, "migrations", sqlFile), "utf8");
        
        // Split by semicolon to handle multiple statements
        const statements = sql.split(";").filter(s => s.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                await db.query(statement);
            }
        }
        
        console.log(`✅ ${name} completed successfully`);
        return true;
    } catch (error) {
        console.error(`❌ ${name} failed:`, error.message);
        return false;
    }
}

async function main() {
    try {
        console.log("🚀 Starting Emoji System Migration...");
        console.log("=====================================");
        
        const results = [];
        
        // Run migrations in order
        results.push(await runMigration("Create system_settings table", "001_create_system_settings.sql"));
        results.push(await runMigration("Populate emoji IDs", "002_populate_emoji_ids.sql"));
        results.push(await runMigration("Populate all category and product emoji IDs", "003_populate_all_emoji_ids.sql"));
        results.push(await runMigration("Update with correct emoji IDs from client", "004_update_correct_emoji_ids.sql"));
        results.push(await runMigration("Add instant UC emoji", "005_add_instant_uc_emoji.sql"));
        
        console.log("\n=====================================");
        if (results.every(r => r)) {
            console.log("✅ All migrations completed successfully!");
            console.log("\n📌 Next steps:");
            console.log("1. Update your .env file if needed");
            console.log("2. Restart your bot");
            console.log("3. Check admin dashboard for emoji management");
        } else {
            console.log("⚠️ Some migrations failed. Check errors above.");
        }
        
    } catch (error) {
        console.error("Fatal error:", error);
    } finally {
        await db.end();
    }
}

main();
