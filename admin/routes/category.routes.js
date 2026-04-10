const express = require("express");
const router = express.Router();
const db = require("../../database/db");

// GET all categories with their subcategories (for admin dashboard)
router.get("/with-subs", async (req, res) => {
    try {
        const categories = await db.query(
            "SELECT * FROM categories WHERE is_active=true ORDER BY position"
        );
        
        for (let cat of categories.rows) {
            const subs = await db.query(
                "SELECT * FROM subcategories WHERE category_id=$1 AND is_active=true ORDER BY position",
                [cat.id]
            );
            cat.subcategories = subs.rows;
        }
        
        res.json(categories.rows);
    } catch (error) {
        console.error("GET categories with subs error:", error);
        res.status(500).json({ error: "Failed to fetch data" });
    }
});

// GET all categories (for bot - includes image_url)
router.get("/", async (req, res) => {
    try {
        const result = await db.query(
            "SELECT id, name, display_name, icon, image_url, position FROM categories WHERE is_active=true ORDER BY position"
        );
        res.json(result.rows);
    } catch (error) {
        console.error("GET categories error:", error);
        res.status(500).json({ error: "Failed to fetch categories" });
    }
});

// CREATE category
router.post("/", async (req, res) => {
    const { name, display_name, icon, image_url, position, is_active } = req.body;

    if (!name || !display_name) {
        return res.status(400).json({ error: "Name and display_name are required" });
    }

    try {
        const result = await db.query(
            `INSERT INTO categories (name, display_name, icon, image_url, position, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [name, display_name, icon || null, image_url || null, position || 0, is_active !== false]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error("CREATE category error:", error);
        res.status(500).json({ error: "Failed to create category" });
    }
});

// UPDATE category
router.put("/:id", async (req, res) => {
    const { display_name, icon, image_url, position, is_active } = req.body;

    try {
        const activeStatus = is_active !== undefined ? is_active : true;
        
        const result = await db.query(
            `UPDATE categories 
             SET display_name = $1, 
                 icon = $2, 
                 image_url = $3, 
                 position = $4, 
                 is_active = $5 
             WHERE id = $6
             RETURNING *`,
            [display_name, icon || null, image_url || null, position || 0, activeStatus, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Category not found" });
        }

        res.json({ success: true, category: result.rows[0] });
    } catch (error) {
        console.error("UPDATE category error:", error);
        res.status(500).json({ error: "Failed to update category" });
    }
});

// DELETE category
router.delete("/:id", async (req, res) => {
    try {
        await db.query("DELETE FROM categories WHERE id=$1", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error("DELETE category error:", error);
        res.status(500).json({ error: "Failed to delete category" });
    }
});

// GET subcategories by category
router.get("/:id/subcategories", async (req, res) => {
    try {
        const result = await db.query(
            "SELECT * FROM subcategories WHERE category_id=$1 AND is_active=true ORDER BY position",
            [req.params.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error("GET subcategories error:", error);
        res.status(500).json({ error: "Failed to fetch subcategories" });
    }
});

// CREATE subcategory
router.post("/subcategories", async (req, res) => {
    const { category_id, name, display_name, position, is_active } = req.body;

    if (!category_id || !name || !display_name) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const result = await db.query(
            `INSERT INTO subcategories (category_id, name, display_name, position, is_active)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [category_id, name, display_name, position || 0, is_active !== false]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error("CREATE subcategory error:", error);
        res.status(500).json({ error: "Failed to create subcategory" });
    }
});

// UPDATE subcategory
router.put("/subcategories/:id", async (req, res) => {
    const { display_name, position, is_active } = req.body;

    try {
        const activeStatus = is_active !== undefined ? is_active : true;
        
        await db.query(
            `UPDATE subcategories 
             SET display_name = $1, position = $2, is_active = $3 
             WHERE id = $4`,
            [display_name, position || 0, activeStatus, req.params.id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error("UPDATE subcategory error:", error);
        res.status(500).json({ error: "Failed to update subcategory" });
    }
});

// DELETE subcategory
router.delete("/subcategories/:id", async (req, res) => {
    try {
        await db.query("DELETE FROM subcategories WHERE id=$1", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error("DELETE subcategory error:", error);
        res.status(500).json({ error: "Failed to delete subcategory" });
    }
});

module.exports = router;