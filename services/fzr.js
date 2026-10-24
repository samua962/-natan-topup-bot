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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll /orders/{id} until codes are available (up to maxAttempts * delayMs).
 * Returns the latest response data.
 */
async function refreshGiftCardOrderDetails(orderId, currentData, maxAttempts = 10, delayMs = 3000) {
  if (!orderId || !currentData?.order) return currentData;

  const hasCodes = (d) =>
    [d?.order?.cards, d?.order?.codes, d?.order?.keys, d?.order?.items,
    d?.order?.gift_cards, d?.order?.voucher_codes]
      .some(arr => Array.isArray(arr) && arr.length > 0);

  const status = String(currentData.order.status || "").toLowerCase();
  if (hasCodes(currentData) || !["created", "processing", "pending", "completed"].includes(status)) {
    return currentData;
  }

  let latest = currentData;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[FZR] Gift card order ${orderId} has no codes yet; polling attempt ${attempt}/${maxAttempts}`);
    const detail = await fzrGet(`/orders/${encodeURIComponent(orderId)}`);
    if (detail.ok && detail.order) {
      latest = detail;
      const detailStatus = String(detail.order.status || "").toLowerCase();
      if (hasCodes(detail)) {
        console.log(`[FZR] Gift card order ${orderId} codes received on attempt ${attempt}`);
        return detail;
      }
      if (detailStatus === "failed" || detailStatus === "cancelled") {
        console.warn(`[FZR] Gift card order ${orderId} status=${detailStatus}, stopping poll`);
        return detail;
      }
    }
    if (attempt < maxAttempts) await sleep(delayMs);
  }
  console.warn(`[FZR] Gift card order ${orderId} codes not found after ${maxAttempts} attempts`);
  return latest;
}

/**
 * Extract all code items from an FZR order response.
 * Returns [{ code, pin, serial, title }] or []
 */
function extractGiftCardCodes(data) {
  const candidates = [
    data?.order?.cards, data?.order?.codes, data?.order?.keys,
    data?.order?.items, data?.order?.gift_cards, data?.order?.voucher_codes,
    data?.cards, data?.codes,
  ];
  for (const list of candidates) {
    if (!Array.isArray(list) || list.length === 0) continue;
    const mapped = list.map((item, i) => {
      if (typeof item === "string") return { code: item, pin: null, title: `Code ${i + 1}` };
      if (!item || typeof item !== "object") return null;
      const code = item.code || item.card || item.key || item.value || item.serial
        || item.pin || item.number || item.voucher || item.voucher_code || item.code_value;
      if (!code) return null;
      return {
        code: String(code),
        pin: (item.pin && String(item.pin) !== String(code)) ? String(item.pin) : null,
        serial: (item.serial && String(item.serial) !== String(code)) ? String(item.serial) : null,
        title: item.name || item.title || item.label || `Code ${i + 1}`,
      };
    }).filter(Boolean);
    if (mapped.length) return mapped;
  }
  return [];
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

/**
 * Create a gift card order via FZR.
 * Uses card_id (not offer_id) as required by the FZR gift cards API,
 * then polls for the code(s) if they are not immediately present.
 *
 * @param {string} categoryId      - FZR gift card category_id
 * @param {string} offerId         - FZR card_id (the offer identifier)
 * @param {Object} [fields]        - optional extra fields
 * @param {string} [idempotencyKey]
 * @returns {{ success, orderId, code, pin, codes, data }}
 */
async function createGiftCardOrder(categoryId, offerId, fields = {}, idempotencyKey = null) {
  if (!FZR_API_KEY) {
    return {
      success: true,
      data: { ok: true, order: { id: `MOCK_GC_${Date.now()}`, status: "processing" } },
      orderId: `MOCK_GC_${Date.now()}`,
      code: null,
      pin: null,
      codes: [],
    };
  }

  const normalizedCategoryId = String(categoryId || "").trim();
  const normalizedOfferId = String(offerId || "").trim();
  if (!normalizedCategoryId || !normalizedOfferId) {
    return { success: false, error: "Missing FZR gift card category_id or offer_id" };
  }

  // FZR gift cards API uses card_id, not offer_id
  const payload = {
    category_id: normalizedCategoryId,
    card_id: normalizedOfferId,
    quantity: 1,
  };

  const requestHeaders = {};
  if (idempotencyKey) requestHeaders["Idempotency-Key"] = idempotencyKey;

  console.log(`[FZR] POST /giftcards/order category_id=${normalizedCategoryId} card_id=${normalizedOfferId}`);

  let res = await fzrPost("/giftcards/order", payload, requestHeaders);

  if (!res || res.ok === false) {
    return { success: false, error: res?.error || "FZR gift card order failed", details: res };
  }

  const orderId = res.order?.id || res.id || res.order_id || null;
  console.log(`[FZR] Gift card order placed category_id=${normalizedCategoryId} card_id=${normalizedOfferId} order_id=${orderId || "unknown"} status=${res.order?.status || "unknown"}`);

  // Poll for codes if not immediately in the response
  if (orderId) {
    res = await refreshGiftCardOrderDetails(orderId, res);
  }

  const codes = extractGiftCardCodes(res);
  const firstCode = codes[0] || null;
  const code = firstCode?.code
    || res.order?.code || res.code || res.serial || res.card_code || null;
  const pin = firstCode?.pin
    || res.order?.pin || res.pin || null;

  return {
    success: res.ok === true || Boolean(res.order),
    data: res,
    orderId,
    code,
    pin,
    codes, // full array: [{ code, pin, serial, title }]
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
  createGiftCardOrder,
  createTelegramStarsOrder,
  createTelegramPremiumOrder,
};
