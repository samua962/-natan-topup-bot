"use strict";

/**
 * services/verify-et.js
 *
 * Verify.ET payment verification client.
 * Replaces the ShegerPay verification path when VERIFY_ET_ENABLED === "true".
 *
 * Exports:
 *   resolveVerifyEtBank(methodName)  → string | null
 *   verifyPaymentWithVerifyEt(bank, transactionId, expectedAmount, options) → Promise<{verified, data?, error?}>
 */

const axios = require("axios");

const VERIFY_ET_BASE = "https://verify.et/api/verify";

// ---------------------------------------------------------------------------
// 1.1  resolveVerifyEtBank — pure mapping function
// ---------------------------------------------------------------------------

/**
 * Maps a human-readable payment method name to a Verify.ET bank identifier.
 * Matching is case-insensitive substring; "cbebirr" is checked before "cbe"
 * to prevent the shorter token from matching first.
 *
 * @param {string} methodName
 * @returns {string|null}
 */
function resolveVerifyEtBank(methodName) {
    if (methodName == null) return null;

    // Normalise: trim and lowercase
    const name = String(methodName).trim().toLowerCase();
    if (!name) return null;

    // Order matters: more-specific tokens first
    if (name.includes("tele-birr") || name.includes("tele birr") || name.includes("telebirr")) {
        return "telebirr";
    }
    // "cbebirr" / "cbe birr" must be checked BEFORE plain "cbe"
    if (name.includes("cbebirr") || name.includes("cbe birr")) {
        return "cbebirr";
    }
    if (name.includes("cbe")) {
        return "cbe";
    }
    if (name.includes("awash")) {
        return "awash";
    }
    if (name.includes("dashen")) {
        return "dashen";
    }
    if (name.includes("birhan")) {
        return "birhan";
    }
    // "abyssinia" or "boa"
    if (name.includes("abyssinia") || name.includes("boa")) {
        return "boa";
    }
    // "ebirr", "e-birr", "e birr", "kaafi" → Verify.ET identifier is "kaafiebirr"
    // Must NOT match telebirr or cbebirr (which also contain "e birr"/"e-birr" substrings)
    if ((name.includes("kaafi") || /\be[\s-]?birr\b/.test(name)) &&
        !name.includes("tele") && !name.includes("cbe")) {
        return "kaafiebirr";
    }
    // "mpesa" or "m-pesa"
    if (name.includes("mpesa") || name.includes("m-pesa")) {
        return "mpesa";
    }
    if (name.includes("siinqee")) {
        return "siinqee";
    }

    return null;
}

// ---------------------------------------------------------------------------
// 1.2  buildVerifyEtPayload — constructs bank-specific request body
// ---------------------------------------------------------------------------

/**
 * Builds the Verify.ET POST body for the given bank.
 *
 * @param {string} bank              - Verify.ET bank identifier
 * @param {string} transactionId     - The transaction / reference number
 * @param {Object} [extra={}]        - Optional extra fields
 * @param {string} [extra.settlementAccount]  - Full merchant account number
 * @param {string} [extra.phone]              - Sender phone (cbebirr)
 * @returns {Object}
 */
function buildVerifyEtPayload(bank, transactionId, extra = {}) {
    const { settlementAccount, phone, senderAccount } = extra;

    let body;

    switch (bank) {
        case "cbe":
            body = {
                bank: "cbe",
                referenceNumber: transactionId,
                // Last 8 digits of the settlement account
                accountSuffix: settlementAccount
                    ? String(settlementAccount).replace(/\D/g, "").slice(-8)
                    : undefined,
            };
            break;

        case "boa":
            body = {
                bank: "boa",
                referenceNumber: transactionId,
                // Last 5 digits of the receiver/settlement account (required by Verify.ET)
                accountSuffix: settlementAccount
                    ? String(settlementAccount).replace(/\D/g, "").slice(-5)
                    : undefined,
            };
            // Note: senderAccount is NOT a Verify.ET documented field for BOA — omit it
            break;

        case "telebirr":
            body = { bank: "telebirr", transactionNumber: transactionId };
            break;

        case "mpesa":
            body = { bank: "mpesa", transactionNumber: transactionId };
            break;

        case "cbebirr":
            body = {
                bank: "cbebirr",
                receiptNumber: transactionId,
                phone: phone != null ? String(phone) : "",
            };
            break;

        case "kaafiebirr":
            // Verify.ET docs: requires referenceNumber (Transfer-Id or receipt URL), phone optional
            body = { bank: "kaafiebirr", referenceNumber: transactionId };
            if (phone) body.phone = String(phone);
            break;

        // dashen, awash, birhan, siinqee — all use referenceNumber
        default:
            body = { bank, referenceNumber: transactionId };
            break;
    }

    // Remove undefined values produced above (e.g. accountSuffix when no settlementAccount)
    Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

    return body;
}

// ---------------------------------------------------------------------------
// 1.3  pollVerification — polls a completed/failed status
// ---------------------------------------------------------------------------

/**
 * Polls GET https://verify.et/api/verify/:requestId until a terminal
 * processingStatus is reached ("completed" or "failed") or 10 attempts are
 * exhausted.
 *
 * @param {string} requestId
 * @param {Object} [opts={}]
 * @param {number} [opts.pollAfterMs=1500]  - Starting poll interval in ms
 * @param {string} [opts.apiKey]            - x-api-key header value
 * @returns {Promise<Object|null>}          - Terminal poll body, or null on timeout
 */
async function pollVerification(requestId, opts = {}) {
    const { pollAfterMs = 1500, apiKey } = opts;
    // 20 attempts × ~3s average = ~60s total — enough for slow banks like CBE
    const MAX_ATTEMPTS = 20;

    const pollHeaders = { "Content-Type": "application/json" };
    if (apiKey) pollHeaders["x-api-key"] = apiKey;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        // Use the hint on first attempt, then fall back to 3s
        const delay = attempt === 0 ? pollAfterMs : 3000;
        await sleep(delay);

        try {
            const res = await axios.get(`${VERIFY_ET_BASE}/${requestId}`, {
                headers: pollHeaders,
                timeout: 15000,
            });

            const envelope = res.data || {};

            // The GET /api/verify/:requestId response shape is:
            //   { success, message, data: { requestId, processingStatus, status, verified, amount, ... } }
            // Unwrap the inner data object if present, otherwise use envelope directly
            const inner = (envelope.data && typeof envelope.data === "object")
                ? envelope.data
                : envelope;

            const processingStatus = (inner.processingStatus || "").toLowerCase();

            console.log(`[verify-et] Poll attempt ${attempt + 1}/${MAX_ATTEMPTS} — requestId=${requestId} processingStatus=${processingStatus} keys=${Object.keys(inner).join(",")}`);

            if (processingStatus === "completed" || processingStatus === "failed") {
                // Return the unwrapped inner object so handleSyncResponse can read fields directly
                // Log full inner to help debug missing fields
                console.log(`[verify-et] Poll completed — inner data:`, JSON.stringify(inner));
                return inner;
            }

            // Still queued/running — honour the server's next poll hint if provided
            const nextPollMs = envelope.links?.pollAfterMs;
            if (nextPollMs && attempt === 0) {
                // Already used pollAfterMs above; server hint for subsequent polls is 3s default
            }

        } catch (err) {
            // Log but keep polling; don't abort the loop on a transient poll error
            console.error(
                `[verify-et] Poll attempt ${attempt + 1} error for ${requestId}:`,
                err.message
            );
        }
    }

    return null; // exhausted
}

/**
 * Generates OCR-corrected variants of a transaction ID.
 * Common OCR confusions: I↔1, O↔0, l↔1, S↔5, B↔8, Z↔2
 * Returns an array of unique alternate IDs to try.
 */
function generateOcrVariants(txId) {
    if (!txId) return [];

    // Map each char to its possible OCR confusions
    const confusions = {
        'I': ['1'],
        '1': ['I'],
        'O': ['0'],
        '0': ['O'],
        'l': ['1', 'I'],
        'S': ['5'],
        '5': ['S'],
        'B': ['8'],
        '8': ['B'],
        'Z': ['2'],
        '2': ['Z'],
    };

    const variants = new Set();

    // Generate variants by flipping one character at a time
    for (let i = 0; i < txId.length; i++) {
        const ch = txId[i];
        const alts = confusions[ch];
        if (alts) {
            for (const alt of alts) {
                const variant = txId.slice(0, i) + alt + txId.slice(i + 1);
                if (variant !== txId) variants.add(variant);
            }
        }
    }

    // Also try all-uppercase version (OCR sometimes lowercases)
    const upper = txId.toUpperCase();
    if (upper !== txId) variants.add(upper);

    return Array.from(variants);
}

// ---------------------------------------------------------------------------
// 1.4  verifyPaymentWithVerifyEt — main verification entry point
// ---------------------------------------------------------------------------

/**
 * Submits a verification request to Verify.ET and resolves to a result object.
 *
 * @param {string} bank              - Verify.ET bank identifier (from resolveVerifyEtBank)
 * @param {string} transactionId     - Transaction / reference ID
 * @param {number} expectedAmount    - Amount the user was supposed to pay (ETB)
 * @param {Object} [options={}]
 * @param {string} [options.settlementAccount] - Full merchant account number
 * @param {string} [options.phone]             - Sender phone (cbebirr)
 * @param {string} [options.senderAccount]     - Sender account number (BOA)
 * @returns {Promise<{verified: boolean, data?: Object, error?: string}>}
 */
async function verifyPaymentWithVerifyEt(bank, transactionId, expectedAmount, options = {}) {
    // Guard: API key check
    const apiKey = process.env.VERIFY_ET_API_KEY;
    if (!apiKey) {
        return { verified: false, error: "Verify.ET API key missing" };
    }

    // Guard: bank must be resolved before calling this function
    if (!bank) {
        return { verified: false, error: "Payment provider could not be determined" };
    }

    // Deterministic idempotency key (same for all retries of this call)
    const idempotencyKey = `${bank}-${transactionId}`;

    const requestHeaders = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "Idempotency-Key": idempotencyKey,
    };

    const requestBody = buildVerifyEtPayload(bank, transactionId, {
        settlementAccount: options.settlementAccount,
        phone: options.phone,
        senderAccount: options.senderAccount,
    });

    const MAX_RETRIES = 2; // default: up to 3 total attempts

    let lastError = null;

    // BOA and Telebirr transactions can take time to propagate in Verify.ET
    const effectiveMaxRetries =
        bank === "boa" ? 4 :        // up to 5 attempts for BOA
            bank === "telebirr" ? 3 :   // up to 4 attempts for Telebirr (~43s total, then manual review)
                MAX_RETRIES;

    // Per-bank not-found retry delays (ms)
    // BOA:      5s, 10s, 20s, 30s
    // Telebirr: 8s, 15s, 20s  (total ~43s max, then fast manual review)
    const boaRetryDelays = [5000, 10000, 20000, 30000];
    const telebirrRetryDelays = [8000, 15000, 20000];

    for (let attempt = 0; attempt <= effectiveMaxRetries; attempt++) {
        if (attempt > 0) {
            const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s, 8s
            console.log(
                `[verify-et] Retrying (attempt ${attempt + 1}/${effectiveMaxRetries + 1}) in ${backoffMs}ms — bank=${bank} txId=${transactionId}`
            );
            await sleep(backoffMs);
        }

        // ── Log the outgoing call (never log the API key value) ──────────────
        console.log(
            `[verify-et] Calling Verify.ET — bank=${bank} txId=${transactionId} expectedAmount=${expectedAmount} attempt=${attempt + 1}`
        );
        console.log(`[verify-et] Request body:`, JSON.stringify(requestBody));

        try {
            const res = await axios.post(
                `${VERIFY_ET_BASE}?waitMs=${bank === "boa" ? 15000 : bank === "telebirr" ? 20000 : 8000}`,
                requestBody,
                { headers: requestHeaders, timeout: 40000 }
            );

            console.log(`[verify-et] Response — HTTP ${res.status} verified=${res.data?.verified}`);
            if (res.status === 200) {
                // Log full response for debugging (remove in production once stable)
                console.log(`[verify-et] Full 200 response:`, JSON.stringify(res.data).substring(0, 500));

                // Check for "not found" — transaction may not have propagated yet
                // Retry up to MAX_RETRIES times with backoff
                const body = res.data || {};
                const topStatus = (body.verification?.status || body.data?.[0]?.status || "").toLowerCase();
                const notFound = topStatus === "not_found" ||
                    (body.message || "").toLowerCase().includes("not found") ||
                    (body.message || "").toLowerCase().includes("no telebirr") ||
                    (body.message || "").toLowerCase().includes("no boa") ||
                    (body.message || "").toLowerCase().includes("no ebirr") ||
                    (body.message || "").toLowerCase().includes("no kaafi") ||
                    (body.message || "").toLowerCase().includes("no transaction");

                if (notFound && attempt < effectiveMaxRetries) {
                    const backoffMs =
                        bank === "boa" ? (boaRetryDelays[attempt] || 30000) :
                            bank === "telebirr" ? (telebirrRetryDelays[attempt] || 15000) :
                                (attempt + 1) * 5000;
                    console.log(`[verify-et] Transaction not found yet, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${effectiveMaxRetries + 1})`);
                    await sleep(backoffMs);
                    continue;
                }

                return await handleSyncResponse(res.data, expectedAmount);
            }

            if (res.status === 202) {
                return await handleAsyncResponse(res.data, expectedAmount, apiKey);
            }

            // Unexpected 2xx — treat as an error
            return {
                verified: false,
                error: `Unexpected HTTP ${res.status} from Verify.ET`,
            };
        } catch (err) {
            const errMsg = err.message || String(err);
            console.error(`[verify-et] Error on attempt ${attempt + 1}:`, errMsg);
            if (err.response) {
                console.error(`[verify-et] HTTP ${err.response.status}:`, JSON.stringify(err.response.data));
            }

            // ── Check retryability ───────────────────────────────────────────────
            const httpStatus = err.response?.status;

            // 4xx except 429 → fail immediately, no retry
            if (httpStatus && httpStatus >= 400 && httpStatus < 500 && httpStatus !== 429) {
                const apiError =
                    err.response.data?.message ||
                    err.response.data?.error ||
                    errMsg;
                return { verified: false, error: apiError };
            }
            const isTransient = isTransientError(err);

            if (!isTransient) {
                // Non-retryable non-4xx error — return immediately
                return {
                    verified: false,
                    error: err.response?.data?.message || errMsg,
                };
            }

            lastError = errMsg;

            if (attempt < effectiveMaxRetries) {
                // Will retry in the next loop iteration
                continue;
            }

            // All retries exhausted
            return { verified: false, error: lastError };
        }
    }

    // All retries exhausted with original ID.
    // Try OCR-corrected variants (e.g. I↔1, O↔0) before giving up.
    const variants = generateOcrVariants(transactionId);
    if (variants.length > 0) {
        console.log(`[verify-et] Trying ${variants.length} OCR-corrected variant(s) for ${transactionId}:`, variants);
        for (const variant of variants) {
            try {
                const variantBody = buildVerifyEtPayload(bank, variant, {
                    settlementAccount: options.settlementAccount,
                    phone: options.phone,
                    senderAccount: options.senderAccount,
                });
                console.log(`[verify-et] OCR variant attempt: ${variant}`);
                const variantHeaders = {
                    ...requestHeaders,
                    "Idempotency-Key": `${bank}-${variant}`,
                };
                const res = await axios.post(
                    `${VERIFY_ET_BASE}?waitMs=${bank === "boa" ? 15000 : bank === "telebirr" ? 20000 : 8000}`,
                    variantBody,
                    { headers: variantHeaders, timeout: 40000 }
                );
                if (res.status === 200) {
                    const body = res.data || {};
                    const topStatus = (body.verification?.status || body.data?.[0]?.status || "").toLowerCase();
                    const isNotFound = topStatus === "not_found" ||
                        (body.message || "").toLowerCase().includes("not found");
                    if (!isNotFound) {
                        console.log(`[verify-et] OCR variant ${variant} succeeded!`);
                        // Return result with the corrected ID noted
                        const result = await handleSyncResponse(res.data, expectedAmount);
                        if (result.verified) {
                            result.correctedTxId = variant;
                        }
                        return result;
                    }
                }
            } catch (e) {
                console.error(`[verify-et] OCR variant ${variant} error:`, e.message);
            }
        }
        console.log(`[verify-et] All OCR variants exhausted — giving up`);
    }

    // Should never reach here
    return { verified: false, error: lastError || "Unknown error" };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Handles a synchronous HTTP 200 response from Verify.ET.
 * The 200 envelope shape is:
 *   { success, message, data: [ { bank, status, verified, amount, timestamp, ... } ], verification: {...} }
 * The completed poll shape is the unwrapped inner object:
 *   { processingStatus, status, verified, amount, timestamp, ... }
 */
async function handleSyncResponse(envelope, expectedAmount) {
    // Unwrap: if envelope.data is an array (200 response), use first element
    // If envelope.data is an object (poll result already unwrapped), use it
    // Otherwise use envelope directly
    let data;
    if (Array.isArray(envelope.data) && envelope.data.length > 0) {
        data = envelope.data[0];
    } else if (envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)) {
        data = envelope.data;
    } else {
        data = envelope;
    }

    // Poll responses put the full transaction data inside data.result
    // Merge it up so all field checks work uniformly
    if (data.result && typeof data.result === "object") {
        data = { ...data, ...data.result };
    }

    // Also check top-level verification object for verified flag (some response shapes)
    const topVerified = envelope.verification?.verified;
    const verified = data.verified != null ? data.verified : topVerified;

    // "status" field: "success" | "failed" | "not_found" | "pending"
    const statusField = (data.status || "").toLowerCase();

    // Determine verified: explicit boolean OR status === "success"
    const isVerified = verified === true || statusField === "success";

    // amount may be absent in poll-only responses — skip amount check if missing
    const amount = data.amount;
    const hasAmount = amount != null && !isNaN(parseFloat(amount));

    // Validate required fields (Req 14.3) — only when we expect full data (amount present)
    if (verified == null && statusField === "") {
        return {
            verified: false,
            error: "Invalid response from Verify.ET: missing required field verified",
        };
    }

    if (!isVerified) {
        return {
            verified: false,
            error: data.message || envelope.message || data.error || "Verification failed",
        };
    }

    // Duplicate detection (Req 6)
    const duplicateResult = checkDuplicate(data);
    if (duplicateResult) return duplicateResult;

    // Settlement account match (Req 7)
    const settlementResult = checkSettlementAccountMatch(data);
    if (settlementResult) return settlementResult;

    // Amount validation — only when amount is present in the response
    if (hasAmount) {
        const amountResult = validateAmount(amount, expectedAmount);
        if (amountResult) return amountResult;
    } else {
        console.log(`[verify-et] Amount not present in response — skipping amount validation`);
    }

    // Timestamp validation (Req 4.6) — only when timestamp present
    if (data.timestamp) {
        const tsResult = validateTimestamp(data.timestamp);
        if (tsResult) return tsResult;
    }

    return { verified: true, data };
}

/**
 * Handles an asynchronous HTTP 202 response from Verify.ET.
 * Extracts requestId, polls until terminal, then validates.
 */
async function handleAsyncResponse(data, expectedAmount, apiKey) {
    // Extract requestId — either directly or from a statusUrl / links.statusUrl
    let requestId = data.requestId || data.id;
    if (!requestId && (data.statusUrl || data.links?.statusUrl)) {
        const url = data.statusUrl || data.links?.statusUrl;
        const match = String(url).match(/\/([^/]+)\s*$/);
        if (match) requestId = match[1];
    }

    if (!requestId) {
        return {
            verified: false,
            error: "Verify.ET returned 202 but no requestId or statusUrl",
        };
    }

    // Prefer the server's poll hint from links.pollAfterMs, then top-level pollAfterMs
    const pollAfterMs = data.links?.pollAfterMs
        || (typeof data.pollAfterMs === "number" ? data.pollAfterMs : 2000);

    console.log(`[verify-et] Queued — requestId=${requestId} pollAfterMs=${pollAfterMs}`);

    const result = await pollVerification(requestId, { pollAfterMs, apiKey });

    if (!result) {
        return {
            verified: false,
            error: "Verification timed out. Your payment is being reviewed.",
        };
    }

    // Re-use the sync validation pipeline on the completed poll result
    return await handleSyncResponse(result, expectedAmount);
}

/**
 * Checks confirmationHistory for prior confirmed entries (Req 6).
 * @returns {Object|null}  Error result if duplicate detected; null otherwise.
 */
function checkDuplicate(data) {
    if (!Array.isArray(data.confirmationHistory) || data.confirmationHistory.length === 0) {
        return null;
    }

    const priorConfirmed = data.confirmationHistory.filter(
        (entry) => entry && (entry.confirmed === true || entry.status === "confirmed")
    );

    if (priorConfirmed.length > 0) {
        console.log(
            `[verify-et] Duplicate detected — ${priorConfirmed.length} prior confirmation(s) found`
        );
        return {
            verified: false,
            error: "Transaction already used. Please make a new payment.",
        };
    }

    return null;
}

/**
 * Checks settlementAccountMatch field (Req 7).
 * Only reject if the transaction was actually FOUND but sent to the wrong account.
 * If the transaction was never found (reason === "verification_not_successful"),
 * skip this check — the "not found" error is returned earlier upstream.
 * @returns {Object|null}
 */
function checkSettlementAccountMatch(data) {
    if (!data.settlementAccountMatch) return null;
    const sam = data.settlementAccountMatch;
    if (sam.matched === false) {
        // If the reason is that the transaction itself wasn't found,
        // don't show a misleading "wrong account" error.
        const reason = (sam.reason || "").toLowerCase();
        if (reason === "verification_not_successful" || reason === "not_found") {
            return null; // let the upstream not_found handling report the real error
        }
        return {
            verified: false,
            error:
                "Payment was not sent to our account. Please check the account number.",
        };
    }
    return null;
}

/**
 * Validates the paid amount against expectedAmount (Req 4.4 / 4.5).
 * @returns {Object|null}
 */
function validateAmount(paidAmount, expectedAmount) {
    const paid = parseFloat(paidAmount);
    const expected = parseFloat(expectedAmount);

    if (isNaN(paid)) {
        return { verified: false, error: "Could not retrieve transaction amount" };
    }

    if (paid < expected - 0.01) {
        return {
            verified: false,
            error: `Amount too low: expected at least ${expected} ETB, got ${paid} ETB`,
        };
    }

    if (paid > expected + 50) {
        return {
            verified: false,
            error: `Amount too high: expected around ${expected} ETB, got ${paid} ETB (max +50 ETB allowed)`,
        };
    }

    return null;
}

/**
 * Validates that the transaction timestamp is ≤30 minutes old (Req 4.6).
 * Expects an ISO-8601 string (Verify.ET uses ISO, unlike ShegerPay's bespoke formats).
 * @returns {Object|null}
 */
function validateTimestamp(timestamp) {
    if (!timestamp) return null; // absent → no rejection

    const txTime = new Date(timestamp);
    if (isNaN(txTime.getTime())) {
        // Unparseable — don't reject; log and continue
        console.warn("[verify-et] Could not parse timestamp:", timestamp);
        return null;
    }

    const diffMinutes = (Date.now() - txTime.getTime()) / (1000 * 60);

    if (diffMinutes > 30) {
        return {
            verified: false,
            error: `Transaction is too old (${Math.round(diffMinutes)} minutes). Please use a recent payment.`,
        };
    }

    return null;
}

/**
 * Returns true when the axios error is considered transient and safe to retry.
 */
function isTransientError(err) {
    const code = err.code || "";
    const status = err.response?.status;
    const msg = (err.message || "").toLowerCase();

    if (
        code === "ENOTFOUND" ||
        code === "ECONNRESET" ||
        code === "ECONNREFUSED" ||
        code === "ETIMEDOUT"
    ) {
        return true;
    }

    if (status === 429) return true;

    if (msg.includes("max retries exceeded")) return true;

    return false;
}

/** Simple promise-based sleep. */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// 1.5  Exports
// ---------------------------------------------------------------------------

module.exports = {
    resolveVerifyEtBank,
    verifyPaymentWithVerifyEt,
};
