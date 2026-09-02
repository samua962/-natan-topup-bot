const express = require("express");
const router = express.Router();
const db = require("../../database/db");
const { getTopupOffers, createTopupOrder, createTelegramStarsOrder, createTelegramPremiumOrder } = require("../../services/fzr");
const axios = require("axios");

async function resolveFzrOffer(order, config) {
  const categoryId = config.category_id || order.external_product_id;
  let offerId = config.offer_id || order.product_id;
  const data = await getTopupOffers(categoryId);
  const offers = Array.isArray(data.offers) ? data.offers : [];
  if (offers.some((offer) => String(offer.offer_id) === String(offerId))) return { categoryId, offerId };
  const productName = String(order.product_name || "").toLowerCase().trim();
  const match = offers.find((offer) => {
    const name = String(offer.name || "").toLowerCase().trim();
    return name === productName || name.includes(productName) || productName.includes(name);
  });
  return { categoryId, offerId: match?.offer_id || offerId };
}


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
  if (order.delivery_type === "fzr" || order.delivery_type === "telegram") {
    let fzrProduct = {};
    try { fzrProduct = JSON.parse(order.external_product_id || "{}"); } catch (_) { }
    if (order.delivery_type === "fzr") fzrProduct = await resolveFzrOffer(order, fzrProduct);
    const result = order.delivery_type === "fzr"
      ? await createTopupOrder(fzrProduct.category_id || order.external_product_id, fzrProduct.offer_id || order.product_id, { player_id: order.player_id })
      : fzrProduct.type === "telegram_stars"
        ? await createTelegramStarsOrder(order.player_id, fzrProduct.value)
        : await createTelegramPremiumOrder(order.player_id, fzrProduct.value);

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
  const order = (await db.query("SELECT * FROM orders WHERE id=$1", [req.params.id])).rows[0];
  if (!order) return res.status(404).json({ error: "Not found" });

  if (order.delivery_type === "fzr" || order.delivery_type === "telegram") {
    let fzrProduct = {};
    try { fzrProduct = JSON.parse(order.external_product_id || "{}"); } catch (_) { }
    if (order.delivery_type === "fzr") fzrProduct = await resolveFzrOffer(order, fzrProduct);
    const result = order.delivery_type === "fzr"
      ? await createTopupOrder(fzrProduct.category_id || order.external_product_id, fzrProduct.offer_id || order.product_id, { player_id: order.player_id })
      : fzrProduct.type === "telegram_stars"
        ? await createTelegramStarsOrder(order.player_id, fzrProduct.value)
        : await createTelegramPremiumOrder(order.player_id, fzrProduct.value);
    if (!result.success) return res.status(502).json({ error: result.error || "Instant delivery failed" });
  }

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