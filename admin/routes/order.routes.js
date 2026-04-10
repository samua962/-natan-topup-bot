const express = require("express");
const router = express.Router();
const db = require("../../database/db");
const { createOrder } = require("../../services/ragner");
const axios = require("axios");


// 📥 GET ALL ORDERS
router.get("/", async (req, res) => {
  const result = await db.query(
    "SELECT * FROM orders ORDER BY id DESC"
  );
  res.json(result.rows);
});

// ✅ APPROVE ORDER
router.post("/:id/approve", async (req, res) => {
  const orderId = req.params.id;

  const order = (await db.query(
    "SELECT * FROM orders WHERE id=$1",
    [orderId]
  )).rows[0];

  if (!order) return res.status(404).json({ error: "Not found" });

  // mark approved
  await db.query(
    "UPDATE orders SET status='APPROVED' WHERE id=$1",
    [orderId]
  );

  // 🔥 INSTANT DELIVERY
  if (order.delivery_type === "ragner") {
    const result = await createOrder(
      order.external_product_id,
      order.player_id
    );

    if (result.success) {
      await db.query(
        "UPDATE orders SET status='COMPLETED' WHERE id=$1",
        [orderId]
      );
    }
  }

  res.json({ message: "Approved" });
});

// ❌ REJECT
router.post("/:id/reject", async (req, res) => {
  await db.query(
    "UPDATE orders SET status='REJECTED' WHERE id=$1",
    [req.params.id]
  );

  res.json({ message: "Rejected" });
});

// 🎯 COMPLETE MANUAL
router.post("/:id/complete", async (req, res) => {
  await db.query(
    "UPDATE orders SET status='COMPLETED' WHERE id=$1",
    [req.params.id]
  );

  res.json({ message: "Completed" });
});

module.exports = router;
// GET all orders
router.get("/", async (req, res) => {
    const result = await db.query(
        "SELECT * FROM orders ORDER BY id DESC"
    );
    res.json(result.rows);
});

// APPROVE
router.post("/:id/approve", async (req, res) => {
    const id = req.params.id;

    await db.query(
        "UPDATE orders SET status='APPROVED' WHERE id=$1",
        [id]
    );

    res.json({ success: true });
});

// COMPLETE (manual)
router.post("/:id/complete", async (req, res) => {
    const id = req.params.id;

    await db.query(
        "UPDATE orders SET status='COMPLETED' WHERE id=$1",
        [id]
    );

    res.json({ success: true });
});

// REJECT
router.post("/:id/reject", async (req, res) => {
    const id = req.params.id;

    await db.query(
        "UPDATE orders SET status='REJECTED' WHERE id=$1",
        [id]
    );

    res.json({ success: true });
});


// 🖼 GET ORDER IMAGE
router.get("/:id/image", async (req, res) => {
  const orderId = req.params.id;

  const order = (await db.query(
    "SELECT payment_file_id FROM orders WHERE id=$1",
    [orderId]
  )).rows[0];

  if (!order || !order.payment_file_id) {
    return res.status(404).json({ error: "No image" });
  }

  try {
    // 🔥 Step 1: Get file path
    const tgRes = await axios.get(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile`,
      {
        params: { file_id: order.payment_file_id }
      }
    );

    const filePath = tgRes.data.result.file_path;

    // 🔥 Step 2: Build real image URL
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;

    res.json({ url: fileUrl });

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch image" });
  }
});

module.exports = router;