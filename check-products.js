require("dotenv").config();
const db = require("./database/db");

(async () => {
    try {
        console.log("📦 Checking products in database...\n");
        const result = await db.query(
            "SELECT id, name, category_id, emoji_id FROM products ORDER BY id LIMIT 20"
        );
        console.log(JSON.stringify(result.rows, null, 2));
        console.log(`\nTotal products fetched: ${result.rows.length}`);
        process.exit(0);
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
})();
