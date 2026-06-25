# Requirements Document

## Introduction

This feature replaces the ShegerPay payment verification API with Verify.ET across the Natan Top Up Bot. The bot verifies Ethiopian bank payments (Telebirr, CBE, BOA, Awash, Dashen, Birhan, MPesa, CBEBirr/eBirr) when users submit payment screenshots for orders and wallet deposits. Verify.ET offers the same verification capabilities via a more modern REST API, supporting synchronous (HTTP 200) and asynchronous (HTTP 202 + polling / webhook) verification flows. The migration must preserve the existing user experience while enabling backward-compatible rollout using a feature flag.

## Glossary

- **Verify.ET**: The new payment verification service at `https://verify.et`, replacing ShegerPay.
- **ShegerPay**: The legacy payment verification service at `https://api.shegerpay.com`, to be retired.
- **Verification_Client**: The module responsible for calling Verify.ET and interpreting the response (replaces the `verifyPaymentWithTxId()` function).
- **Provider_Mapper**: The module that translates a human-readable payment method name (e.g., "Bank of Abyssinia") into a Verify.ET `bank` identifier (e.g., `"boa"`).
- **Webhook_Receiver**: The Express route in `admin/routes/webhook.routes.js` that receives async verification callbacks from Verify.ET.
- **Bot**: The Telegram bot running in `bot/bot.js`.
- **Admin_Panel**: The Express server in `admin/server.js`.
- **Instant Response**: A Verify.ET HTTP 200 response indicating the transaction has been verified synchronously.
- **Queued Response**: A Verify.ET HTTP 202 response indicating verification is in progress; includes a `statusUrl` for polling.
- **Feature_Flag**: The environment variable `VERIFY_ET_ENABLED` that enables or disables the Verify.ET client at runtime.
- **Settlement_Account**: The merchant's bank account number used to confirm the payment was sent to the correct destination.
- **Confirmation_History**: A field in the Verify.ET response listing prior confirmations of the same transaction, used for duplicate detection.
- **Idempotency_Key**: An optional HTTP header sent to Verify.ET to safely retry requests without double-processing.

---

## Requirements

### Requirement 1: Feature Flag and Backward Compatibility

**User Story:** As an operator, I want to toggle between ShegerPay and Verify.ET without redeploying, so that I can roll back instantly if issues arise.

#### Acceptance Criteria

1. THE Bot SHALL read the environment variable `VERIFY_ET_ENABLED` at startup to determine which verification provider to use.
2. WHEN `VERIFY_ET_ENABLED` is `"true"`, THE Verification_Client SHALL route all payment verification calls to Verify.ET.
3. WHEN `VERIFY_ET_ENABLED` is not `"true"`, THE Verification_Client SHALL route all payment verification calls to ShegerPay using the existing logic, leaving the legacy path unchanged.
4. THE Bot SHALL support both `SHEGERPAY_API_KEY` / `SHEGERPAY_ENABLED` and `VERIFY_ET_API_KEY` / `VERIFY_ET_ENABLED` environment variables simultaneously without conflict.
5. IF `VERIFY_ET_ENABLED` is `"true"` and `VERIFY_ET_API_KEY` is absent or empty, THEN THE Verification_Client SHALL return `{ verified: false, error: "Verify.ET API key missing" }` without making any HTTP request.

---

### Requirement 2: Bank Provider Mapping

**User Story:** As the system, I want to translate payment method names stored in the database into Verify.ET bank identifiers, so that the correct verification request is constructed for each bank.

#### Acceptance Criteria

1. THE Provider_Mapper SHALL map the following payment method names to Verify.ET bank identifiers:

   | Payment method name (case-insensitive substring) | Verify.ET `bank` value |
   |---------------------------------------------------|------------------------|
   | "telebirr", "tele-birr", "tele birr"             | `"telebirr"`           |
   | "cbe" (excluding "cbebirr")                       | `"cbe"`                |
   | "cbebirr", "cbe birr"                             | `"cbebirr"`            |
   | "awash"                                           | `"awash"`              |
   | "dashen"                                          | `"dashen"`             |
   | "birhan"                                          | `"birhan"`             |
   | "abyssinia", "boa"                                | `"boa"`                |
   | "ebirr", "e-birr", "kaafi"                        | `"ebirr"`              |
   | "mpesa", "m-pesa"                                 | `"mpesa"`              |
   | "siinqee"                                         | `"siinqee"`            |

2. IF a payment method name does not match any known bank, THEN THE Provider_Mapper SHALL return `null`.
3. WHEN THE Provider_Mapper returns `null`, THE Verification_Client SHALL return `{ verified: false, error: "Payment provider could not be determined" }`.
4. THE Provider_Mapper SHALL be a pure function that accepts a string and returns a string or null.
5. THE Provider_Mapper SHALL normalize input by trimming whitespace and converting to lowercase before matching.

---

### Requirement 3: Verify.ET Request Construction

**User Story:** As the system, I want to build the correct request body for each bank's Verify.ET endpoint, so that each bank's unique field requirements are satisfied.

#### Acceptance Criteria

1. WHEN the resolved bank is `"cbe"`, THE Verification_Client SHALL include `{ bank: "cbe", referenceNumber: <transactionId>, accountSuffix: <last8DigitsOfSettlementAccount> }` in the request body.
2. WHEN the resolved bank is `"telebirr"`, THE Verification_Client SHALL include `{ bank: "telebirr", transactionNumber: <transactionId> }` in the request body.
3. WHEN the resolved bank is `"boa"`, THE Verification_Client SHALL include `{ bank: "boa", referenceNumber: <transactionId>, accountSuffix: <last5DigitsOfSettlementAccount> }` in the request body.
4. WHEN the resolved bank is `"mpesa"`, THE Verification_Client SHALL include `{ bank: "mpesa", transactionNumber: <transactionId> }` in the request body.
5. WHEN the resolved bank is `"cbebirr"`, THE Verification_Client SHALL include `{ bank: "cbebirr", receiptNumber: <transactionId>, phone: <senderPhone> }` in the request body, where `senderPhone` defaults to an empty string when not supplied.
6. WHEN the resolved bank is one of `"dashen"`, `"awash"`, `"birhan"`, `"siinqee"`, `"ebirr"`, THE Verification_Client SHALL include `{ bank: <bankId>, referenceNumber: <transactionId> }` in the request body.
7. THE Verification_Client SHALL include the `x-api-key` header set to the value of `VERIFY_ET_API_KEY` in every request.
8. THE Verification_Client SHALL include `Content-Type: application/json` in every request.
9. WHERE a `settlementAccount` is provided by the caller, THE Verification_Client SHALL include `{ settlementAccount: <account> }` in the request body.
10. THE Verification_Client SHALL send requests to `POST https://verify.et/api/verify`.

---

### Requirement 4: Synchronous Verification (HTTP 200)

**User Story:** As a user, I want my payment verified immediately so I receive instant feedback after submitting a screenshot.

#### Acceptance Criteria

1. WHEN Verify.ET responds with HTTP 200, THE Verification_Client SHALL parse the response body to determine verification outcome.
2. WHEN the response field `verified` is `true`, THE Verification_Client SHALL treat the transaction as verified.
3. WHEN the response field `verified` is `false`, THE Verification_Client SHALL return `{ verified: false, error: <message from response or "Verification failed"> }`.
4. WHEN the verified amount is less than `expectedAmount - 0.01` ETB, THE Verification_Client SHALL return `{ verified: false, error: "Amount too low: expected at least <N> ETB, got <M> ETB" }`.
5. WHEN the verified amount exceeds `expectedAmount + 50` ETB, THE Verification_Client SHALL return `{ verified: false, error: "Amount too high: expected around <N> ETB, got <M> ETB (max +50 ETB allowed)" }`.
6. WHEN the response includes a `timestamp` field, THE Verification_Client SHALL parse it and reject transactions older than 30 minutes with `{ verified: false, error: "Transaction is too old (<N> minutes). Please use a recent payment." }`.
7. WHEN verification succeeds, THE Verification_Client SHALL return `{ verified: true, data: <fullResponseBody> }`.

---

### Requirement 5: Asynchronous Verification (HTTP 202 Polling)

**User Story:** As a user, I want the bot to wait for queued verifications to complete so I still receive an automatic result without needing admin intervention.

#### Acceptance Criteria

1. WHEN Verify.ET responds with HTTP 202, THE Verification_Client SHALL extract the `statusUrl` from the response body.
2. WHEN a `statusUrl` is available, THE Verification_Client SHALL poll the `statusUrl` at 3-second intervals until the status changes from `"queued"` to a terminal state.
3. THE Verification_Client SHALL attempt polling a maximum of 10 times before stopping.
4. WHEN polling completes with a `verified: true` result, THE Verification_Client SHALL apply the same amount and timestamp validations defined in Requirement 4.
5. WHEN polling exhausts all attempts without a terminal result, THE Verification_Client SHALL return `{ verified: false, error: "Verification timed out. Your payment is being reviewed." }`.
6. WHEN polling a `statusUrl`, THE Verification_Client SHALL include the `x-api-key` header in each poll request.

---

### Requirement 6: Duplicate Transaction Detection

**User Story:** As an operator, I want duplicate transactions to be rejected automatically so users cannot reuse a single payment for multiple orders.

#### Acceptance Criteria

1. WHEN Verify.ET returns a response containing `confirmationHistory` with one or more prior confirmed entries, THE Verification_Client SHALL treat the transaction as a duplicate.
2. WHEN a duplicate is detected via `confirmationHistory`, THE Verification_Client SHALL return `{ verified: false, error: "Transaction already used. Please make a new payment." }`.
3. WHEN Verify.ET indicates the transaction is verified, THE Bot SHALL also check the local database for an existing `deposit_requests` or `orders` row with the same `transaction_id` and a status of `APPROVED` or `COMPLETED`.
4. WHEN a local duplicate is found, THE Bot SHALL reject the payment with the message "⚠️ This transaction has already been used for a previous payment. Please make a new payment and send a new screenshot."

---

### Requirement 7: Settlement Account Matching

**User Story:** As an operator, I want to confirm payments were sent to the correct merchant account so fraudulent redirections are rejected.

#### Acceptance Criteria

1. WHERE a `settlementAccount` is configured for a payment method, THE Verification_Client SHALL pass it in the request body and evaluate the `settlementAccountMatch` field in the Verify.ET response.
2. WHEN `settlementAccountMatch` is `false` in the Verify.ET response, THE Verification_Client SHALL return `{ verified: false, error: "Payment was not sent to our account. Please check the account number." }`.
3. WHEN `settlementAccountMatch` is absent or null in the response, THE Verification_Client SHALL not fail the verification on account matching alone.

---

### Requirement 8: Transient Error Handling and Retry

**User Story:** As a user, I want temporary network failures to be retried automatically so I don't have to resubmit my screenshot due to brief connectivity issues.

#### Acceptance Criteria

1. WHEN a network error (ENOTFOUND, ECONNRESET, ECONNREFUSED, ETIMEDOUT, or "Max retries exceeded") occurs, THE Verification_Client SHALL retry the request using exponential backoff.
2. THE Verification_Client SHALL retry at most 2 additional times (3 attempts total) for transient errors.
3. THE Verification_Client SHALL wait `2^attempt * 1000` milliseconds between retry attempts (1 s, 2 s).
4. WHEN all retry attempts are exhausted, THE Verification_Client SHALL return `{ verified: false, error: <last error message> }`.
5. WHEN Verify.ET returns HTTP 4xx (excluding 429), THE Verification_Client SHALL not retry and SHALL return the error immediately.
6. WHEN Verify.ET returns HTTP 429 (rate limited), THE Verification_Client SHALL treat it as a transient error and apply the retry logic.

---

### Requirement 9: Idempotency

**User Story:** As the system, I want retry requests to be idempotent so Verify.ET does not double-charge or double-verify the same transaction.

#### Acceptance Criteria

1. THE Verification_Client SHALL generate a unique `Idempotency-Key` for each verification call before making the first attempt.
2. THE Verification_Client SHALL use the same `Idempotency-Key` value for all retry attempts of a single verification call.
3. THE Verification_Client SHALL include the `Idempotency-Key` as an HTTP header on every request to `POST https://verify.et/api/verify`.
4. THE Verification_Client SHALL derive the `Idempotency-Key` from a combination of `transactionId` and `bank` to be deterministic and collision-resistant.

---

### Requirement 10: Webhook Receiver Update

**User Story:** As an operator, I want the webhook endpoint to handle Verify.ET callbacks so async payment confirmations are processed without polling.

#### Acceptance Criteria

1. THE Webhook_Receiver SHALL expose a route at `POST /webhook/verify-et` to receive Verify.ET callback events.
2. WHEN a Verify.ET webhook is received with a `verified: true` payload, THE Webhook_Receiver SHALL apply the same deposit/order matching and wallet-update logic as the existing ShegerPay webhook handler.
3. THE Webhook_Receiver SHALL retain the existing ShegerPay route at `POST /webhook/shegerpay` unchanged to support rollback.
4. WHEN a Verify.ET webhook body does not contain a recognizable event payload, THE Webhook_Receiver SHALL respond with HTTP 400 and log the unrecognized payload.
5. THE Webhook_Receiver SHALL respond with HTTP 200 within 5 seconds of receiving a Verify.ET webhook to prevent redelivery.
6. WHERE `VERIFY_ET_WEBHOOK_SECRET` is configured, THE Webhook_Receiver SHALL verify the HMAC-SHA256 signature on incoming Verify.ET webhooks before processing.
7. IF signature verification fails, THEN THE Webhook_Receiver SHALL respond with HTTP 401 and SHALL NOT process the payload.

---

### Requirement 11: Environment Variable Configuration

**User Story:** As an operator, I want all Verify.ET configuration in environment variables so credentials are not hardcoded.

#### Acceptance Criteria

1. THE Bot SHALL read `VERIFY_ET_API_KEY` for the Verify.ET API key.
2. THE Bot SHALL read `VERIFY_ET_ENABLED` (`"true"` / `"false"`) to toggle Verify.ET.
3. THE Bot SHALL read `VERIFY_ET_WEBHOOK_SECRET` for validating incoming Verify.ET webhook signatures.
4. THE Bot SHALL read `VERIFY_ET_POLL_TIMEOUT_MS` (optional, default `30000`) for the total polling timeout window.
5. THE Bot SHALL continue reading `SHEGERPAY_API_KEY` and `SHEGERPAY_ENABLED` for the legacy path.
6. THE Admin_Panel SHALL read the same `VERIFY_ET_*` variables from the shared `.env` file.

---

### Requirement 12: Logging and Observability

**User Story:** As an operator, I want verification attempts and results logged consistently so I can diagnose failures without exposing credentials.

#### Acceptance Criteria

1. WHEN THE Verification_Client calls Verify.ET, THE Bot SHALL log the bank identifier, transaction ID, expected amount, and attempt number.
2. WHEN Verify.ET returns a response, THE Bot SHALL log the HTTP status code and the `verified` field value.
3. THE Bot SHALL log error messages returned by Verify.ET.
4. THE Bot SHALL NOT log the value of `VERIFY_ET_API_KEY` or `SHEGERPAY_API_KEY` in any log output.
5. WHEN a duplicate transaction is detected via `confirmationHistory`, THE Bot SHALL log the number of prior confirmations found.

---

### Requirement 13: No User-Facing Flow Changes

**User Story:** As a user, I want the purchase and deposit flow to remain identical so I don't need to learn a new process.

#### Acceptance Criteria

1. THE Bot SHALL preserve all existing Telegram user-facing messages, prompts, and button labels after the migration.
2. THE Bot SHALL continue requesting a payment screenshot from users via the same flow defined in `bot/bot.js`.
3. THE Bot SHALL continue prompting BOA users for their sender account number before verifying.
4. WHEN auto-verification fails, THE Bot SHALL continue falling back to manual admin review using the same messaging and inline keyboard buttons.
5. THE Bot SHALL continue processing OCR receipt text via `extractTxIdFromImage()` before calling the Verification_Client.

---

### Requirement 14: Round-Trip Serialization of Verify.ET Responses

**User Story:** As a developer, I want Verify.ET response parsing to be round-trip stable so that serialization bugs don't silently corrupt verification data.

#### Acceptance Criteria

1. THE Verification_Client SHALL parse Verify.ET JSON responses into structured objects using a consistent schema.
2. FOR ALL valid Verify.ET response objects, serializing then deserializing the object SHALL produce an equivalent object (round-trip property).
3. WHEN a required response field (`verified`, `amount`) is absent or null, THE Verification_Client SHALL return `{ verified: false, error: "Invalid response from Verify.ET: missing required field <fieldName>" }`.
