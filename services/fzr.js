const axios = require("axios");

const BASE_URL = process.env.FZR_BASE_URL || "https://api.fzr.cards/api/v2";
const FZR_API_KEY = process.env.FZR_API_KEY;

function buildHeaders(custom = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...custom,
  };

  if (FZR_API_KEY) {
    headers["X-API-Key"] = FZR_API_KEY;
  }

  return headers;
}

async function fzrGet(path, params = {}) {
  try {
    const res = await axios.get(`${BASE_URL}${path}`, {
      headers: buildHeaders(),
      params,
      timeout: 20000,
    });

    return res.data || {};
  } catch (err) {
    console.error(`[FZR] GET ${path} failed:`, err.response?.data || err.message);
    return { ok: false, error: err.response?.data?.error || err.message, items: [] };
  }
}

async function fzrPost(path, payload = {}, extraHeaders = {}) {
  try {
    const res = await axios.post(`${BASE_URL}${path}`, payload, {
      headers: buildHeaders(extraHeaders),
      timeout: 30000,
    });
    return res.data || {};
  } catch (err) {
    console.error(`[FZR] POST ${path} failed:`, err.response?.data || err.message);
    return { ok: false, error: err.response?.data?.error || err.message };
  }
}

async function getTopupCategories(limit = 100) {
  const data = await fzrGet("/topups", { limit });
  return {
    ok: data.ok !== false,
    kind: "topup",
    items: Array.isArray(data.items) ? data.items : [],
    meta: data.meta || {},
  };
}

async function getGiftCardCategories(limit = 100) {
  const data = await fzrGet("/giftcards", { limit });
  return {
    ok: data.ok !== false,
    kind: "gift_card",
    items: Array.isArray(data.items) ? data.items : [],
    meta: data.meta || {},
  };
}

async function getGameKeyCategories(limit = 100) {
  const data = await fzrGet("/gamekeys", { limit });
  return {
    ok: data.ok !== false,
    kind: "game_key",
    items: Array.isArray(data.items) ? data.items : [],
    meta: data.meta || {},
  };
}

async function getTopupOffers(categoryId) {
  const data = await fzrGet("/topups/offers", { category_id: categoryId, include_ui: 1 });
  return {
    ok: data.ok !== false,
    kind: "topup",
    category_id: data.category_id || categoryId,
    offers: Array.isArray(data.offers) ? data.offers : [],
    fields: Array.isArray(data.fields) ? data.fields : [],
    meta: data.meta || {},
  };
}

async function getGiftCardOffers(categoryId) {
  const data = await fzrGet("/giftcards/cards", { category_id: categoryId, include_ui: 1 });
  return {
    ok: data.ok !== false,
    kind: "gift_card",
    category_id: data.category_id || categoryId,
    offers: Array.isArray(data.offers) ? data.offers : [],
    fields: Array.isArray(data.fields) ? data.fields : [],
    meta: data.meta || {},
  };
}

async function getGameKeyOffers(gameId) {
  const data = await fzrGet("/gamekeys/keys", { game_id: gameId, include_ui: 1 });
  return {
    ok: data.ok !== false,
    kind: "game_key",
    category_id: data.game_id || gameId,
    offers: Array.isArray(data.keys) ? data.keys : [],
    fields: Array.isArray(data.fields) ? data.fields : [],
    meta: data.meta || {},
  };
}

async function validatePlayer(categoryId, playerId) {
  if (!FZR_API_KEY) {
    return { success: true, valid: true, data: { nickname: "Mock Player" } };
  }

  const categoryText = String(categoryId || "").toLowerCase();
  const validationCategory = categoryText.includes("free_fire") || categoryText.includes("freefire")
    ? "free_fire"
    : categoryText.includes("mobile_legends") || categoryText.includes("mlbb")
      ? "mobile_legends"
      : "pubg_mobile";

  const payload = {
    category_id: validationCategory,
    fields: { player_id: playerId },
  };

  const res = await fzrPost("/topups/validate-id", payload);
  if (!res || res.ok === false) {
    return null;
  }

  return {
    success: res.valid === true || res.ok === true,
    valid: res.valid === true || res.ok === true,
    data: {
      nickname: res.player_name || res.account_name || res.data?.nickname || res.data?.player_name || null,
    },
  };
}

async function createTopupOrder(categoryId, offerId, fields = {}, idempotencyKey = null) {
  if (!FZR_API_KEY) {
    return {
      success: true,
      data: { ok: true, order: { id: `MOCK_FZR_${Date.now()}`, status: "processing" } },
      orderId: `MOCK_FZR_${Date.now()}`,
    };
  }

  const normalizedCategoryId = String(categoryId || "").trim();
  const normalizedOfferId = String(offerId || "").trim();
  if (!normalizedCategoryId || !normalizedOfferId) {
    return { success: false, error: "Missing FZR category_id or offer_id" };
  }

  const payload = {
    category_id: normalizedCategoryId,
    offer_id: normalizedOfferId,
    fields,
  };

  const requestHeaders = {};
  if (idempotencyKey) {
    requestHeaders["Idempotency-Key"] = idempotencyKey;
  }

  console.log(`[FZR] POST /topups/order category_id=${normalizedCategoryId} offer_id=${normalizedOfferId}`);

  const res = await fzrPost("/topups/order", payload, requestHeaders);

  if (!res || res.ok === false) {
    return {
      success: false,
      error: res?.error || "FZR order failed",
      details: res,
    };
  }

  console.log(`[FZR] Order delivered category_id=${normalizedCategoryId} offer_id=${normalizedOfferId} order_id=${res.order?.id || res.id || res.order_id || "unknown"}`);

  return {
    success: res.ok === true || Boolean(res.order),
    data: res,
    orderId: res.order?.id || res.id || res.order_id || null,
  };
}

async function getTelegramStars() {
  const data = await fzrGet("/telegram/stars", { include_ui: 1 });
  return {
    ok: data.ok !== false,
    kind: "telegram_stars",
    items: Array.isArray(data.items) ? data.items : Array.isArray(data.plans) ? data.plans : [],
    price_per_star: Number(data.price_per_star || 0),
    min_amount: Number(data.min_amount || 50),
    max_amount: Number(data.max_amount || 10000),
    rates_updated_at: data.rates_updated_at || null,
    meta: data.meta || {},
  };
}

async function getTelegramPremium() {
  const data = await fzrGet("/telegram/premium", { include_ui: 1 });
  return {
    ok: data.ok !== false,
    kind: "telegram_premium",
    items: Array.isArray(data.items) ? data.items : Array.isArray(data.plans) ? data.plans : [],
    plans: Array.isArray(data.plans) ? data.plans : [],
    rates_updated_at: data.rates_updated_at || null,
    meta: data.meta || {},
  };
}

async function createTelegramStarsOrder(telegramUsername, quantity) {
  const payload = { telegram_username: telegramUsername, quantity: Number(quantity || 1) };
  const res = await fzrPost("/telegram/stars/buy", payload);
  return {
    success: res.ok === true || Boolean(res.order),
    data: res,
    orderId: res.order?.id || res.id || res.order_id || null,
  };
}

async function createTelegramPremiumOrder(telegramUsername, months) {
  const payload = { telegram_username: telegramUsername, months: Number(months || 1) };
  const res = await fzrPost("/telegram/premium/buy", payload);
  return {
    success: res.ok === true || Boolean(res.order),
    data: res,
    orderId: res.order?.id || res.id || res.order_id || null,
  };
}

module.exports = {
  BASE_URL,
  getTopupCategories,
  getGiftCardCategories,
  getGameKeyCategories,
  getTopupOffers,
  getGiftCardOffers,
  getGameKeyOffers,
  getTelegramStars,
  getTelegramPremium,
  validatePlayer,
  createTopupOrder,
  createTelegramStarsOrder,
  createTelegramPremiumOrder,
};
