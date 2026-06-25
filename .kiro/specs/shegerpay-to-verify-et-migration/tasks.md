# Implementation Tasks

## Task List

- [x] 1. Create Verify.ET service module (`services/verify-et.js`)
  - [x] 1.1 Implement `resolveVerifyEtBank(methodName)` — pure function mapping payment method names to Verify.ET bank IDs (telebirr, cbe, cbebirr, boa, awash, dashen, birhan, siinqee, ebirr, mpesa); returns null for unknown providers
  - [x] 1.2 Implement `buildVerifyEtPayload(bank, transactionId, extra)` — constructs the correct bank-specific request body (referenceNumber+accountSuffix for cbe/boa, transactionNumber for telebirr/mpesa, receiptNumber+phone for cbebirr, referenceNumber for the rest)
  - [x] 1.3 Implement `pollVerification(requestId)` — polls `GET https://verify.et/api/verify/:requestId` every 1.5 s (using pollAfterMs hint), max 10 attempts; stops on `completed` or `failed` processingStatus
  - [x] 1.4 Implement `verifyPaymentWithVerifyEt(bank, transactionId, expectedAmount, options)` — submits `POST https://verify.et/api/verify?waitMs=8000`, handles HTTP 200 (complete) and 202 (queued→poll), validates amount bounds, validates timestamp (≤30 min old using ISO field), detects duplicates via `confirmationHistory`, checks `settlementAccountMatch`, applies exponential-backoff retry (max 2 retries) for transient errors (ENOTFOUND, ECONNRESET, ECONNREFUSED, ETIMEDOUT, 429); includes `x-api-key`, `Content-Type`, and deterministic `Idempotency-Key` (`<bank>-<transactionId>`) headers
  - [x] 1.5 Export `{ resolveVerifyEtBank, verifyPaymentWithVerifyEt }`
  - Acceptance criteria: Requirements 2, 3, 4, 5, 6, 7, 8, 9, 12

- [x] 2. Add feature-flag routing in `bot/bot.js`
  - [x] 2.1 Import `{ resolveVerifyEtBank, verifyPaymentWithVerifyEt }` from `../services/verify-et`
  - [x] 2.2 Replace the direct `verifyPaymentWithTxId` call sites with a new wrapper that checks `process.env.VERIFY_ET_ENABLED === "true"`: if true, calls `verifyPaymentWithVerifyEt`; otherwise falls through to existing ShegerPay logic unchanged
  - [x] 2.3 Update `resolveShegerPayProvider` → keep as-is; add parallel `resolveVerifyEtBank` call only on the Verify.ET path
  - [x] 2.4 For the Verify.ET path, pass `accountSuffix` from the stored settlement account config (last 8 digits for CBE, last 5 for BOA) and the `settlementAccount` string when available
  - Acceptance criteria: Requirements 1, 2, 13

- [x] 3. Add Verify.ET webhook endpoint in `admin/routes/webhook.routes.js`
  - [x] 3.1 Add `POST /verify-et` route that reads raw body for HMAC-SHA256 signature verification (format: `sha256=<hex>` over `${X-Webhook-Timestamp}.${rawBody}` using `VERIFY_ET_WEBHOOK_SECRET`)
  - [x] 3.2 Reuse existing `findPendingDepositByTxId`, `findPendingOrderByTxId`, `updateWalletBalance`, and `handlePaymentVerified`-style logic — map Verify.ET webhook payload fields (`data.referenceNumber` / `data.transactionNumber`, `data.amount`, `data.bank`) to the same internal handler
  - [x] 3.3 Return HTTP 204 on success, HTTP 400 for unrecognized payload, HTTP 401 on signature mismatch
  - [x] 3.4 Keep the existing `POST /shegerpay` route completely unchanged
  - [x] 3.5 Register the raw-body middleware for `/webhook/verify-et` in `admin/server.js` (same pattern as the existing ShegerPay raw-body middleware)
  - Acceptance criteria: Requirements 10, 11

- [x] 4. Update environment variable wiring
  - [x] 4.1 Add `VERIFY_ET_API_KEY`, `VERIFY_ET_ENABLED`, `VERIFY_ET_WEBHOOK_SECRET`, and `VERIFY_ET_POLL_TIMEOUT_MS` to the `.env` file (with placeholder values) alongside existing ShegerPay vars
  - [x] 4.2 Confirm `services/verify-et.js` reads `process.env.VERIFY_ET_API_KEY` and returns `{ verified: false, error: "Verify.ET API key missing" }` when the key is absent and `VERIFY_ET_ENABLED` is true
  - Acceptance criteria: Requirements 1, 11

- [x] 5. Update settings route for Verify.ET webhook secret
  - [x] 5.1 Add `GET /api/settings/verify-et-webhook-secret` — reads `verify_et_webhook_secret` from settings table
  - [x] 5.2 Add `POST /api/settings/verify-et-webhook-secret` — upserts `verify_et_webhook_secret` with min-32-char validation
  - [x] 5.3 Keep existing `shegerpay_webhook_secret` endpoints unchanged
  - Acceptance criteria: Requirements 10, 11
