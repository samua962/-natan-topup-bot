const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function createAdmin() {
    const username = "admin";
    const password = "admin123"; // Change this to a secure password
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            "INSERT INTO admin_users (username, password) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING",
            [username, hashedPassword]
        );
        console.log("Admin user created! Username: admin, Password: admin123");
        console.log("Please change the password after first login!");
    } catch (error) {
        console.error("Error creating admin:", error);
    }
    process.exit();
}

createAdmin();