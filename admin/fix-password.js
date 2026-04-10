const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "natan_topup",
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

async function fixPassword() {
    try {
        const username = "admin";
        const password = "admin123";
        
        // Generate bcrypt hash
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log("Generated hash:", hashedPassword);
        
        // Update or insert admin user
        await pool.query(`
            INSERT INTO admin_users (username, password) 
            VALUES ($1, $2)
            ON CONFLICT (username) 
            DO UPDATE SET password = $2
        `, [username, hashedPassword]);
        
        console.log("✅ Admin password fixed!");
        console.log("📝 Username: admin");
        console.log("🔑 Password: admin123");
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
    process.exit();
}

fixPassword();