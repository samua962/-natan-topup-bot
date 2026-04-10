const express = require("express");
const router = express.Router();
const db = require("../../database/db");

// GET all products
router.get("/", async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                p.*,
                c.display_name as category_name,
                s.display_name as subcategory_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN subcategories s ON p.subcategory_id = s.id
            ORDER BY p.id DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error("GET products error:", error);
        res.status(500).json({ error: "Failed to fetch products" });
    }
});

// GET products by category (for categories without subcategories)
router.get("/by-category/:catId", async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM products 
            WHERE category_id = $1 AND is_active = true 
            ORDER BY position ASC, id ASC
        `, [req.params.catId]);
        res.json(result.rows);
    } catch (error) {
        console.error("GET products by category error:", error);
        res.status(500).json({ error: "Failed to fetch products" });
    }
});

// GET products by subcategory (for categories with subcategories)
router.get("/by-subcategory/:subId", async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM products 
            WHERE subcategory_id = $1 AND is_active = true 
            ORDER BY position ASC, id ASC
        `, [req.params.subId]);
        res.json(result.rows);
    } catch (error) {
        console.error("GET products by subcategory error:", error);
        res.status(500).json({ error: "Failed to fetch products" });
    }
});

// CREATE product (subcategory_id is optional)
router.post("/", async (req, res) => {
    const {
        name,
        description,
        price_etb,
        category_id,
        subcategory_id,  // Can be null
        product_type,
        requires_fields,
        warning_message,
        position,
        is_active
    } = req.body;

    // Only validate required fields
    if (!name || !price_etb || !category_id || !product_type) {
        return res.status(400).json({ error: "Missing required fields: name, price_etb, category_id, product_type" });
    }

    try {
        const result = await db.query(
            `INSERT INTO products 
            (name, description, price_etb, category_id, subcategory_id, 
             product_type, requires_fields, warning_message, position, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
            RETURNING *`,
            [name, description || null, price_etb, category_id, subcategory_id || null, 
             product_type, requires_fields || null, warning_message || null, 
             position || 0, is_active !== false]
        );

        res.json({ success: true, product: result.rows[0] });
    } catch (error) {
        console.error("CREATE product error:", error);
        res.status(500).json({ error: "Failed to create product" });
    }
});

// UPDATE product
router.put("/:id", async (req, res) => {
    const {
        name,
        description,
        price_etb,
        category_id,
        subcategory_id,
        product_type,
        requires_fields,
        warning_message,
        position,
        is_active
    } = req.body;

    try {
        const result = await db.query(
            `UPDATE products 
            SET name = $1, 
                description = $2, 
                price_etb = $3, 
                category_id = $4, 
                subcategory_id = $5, 
                product_type = $6,
                requires_fields = $7,
                warning_message = $8,
                position = $9,
                is_active = $10
            WHERE id = $11
            RETURNING *`,
            [name, description || null, price_etb, category_id, subcategory_id || null, 
             product_type, requires_fields || null, warning_message || null, 
             position || 0, is_active, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json({ success: true, product: result.rows[0] });
    } catch (error) {
        console.error("UPDATE product error:", error);
        res.status(500).json({ error: "Failed to update product" });
    }
});

// DELETE product
router.delete("/:id", async (req, res) => {
    try {
        const result = await db.query("DELETE FROM products WHERE id = $1 RETURNING id", [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json({ success: true, message: "Product deleted" });
    } catch (error) {
        console.error("DELETE product error:", error);
        res.status(500).json({ error: "Failed to delete product" });
    }
});

module.exports = router;