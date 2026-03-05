# Written Analysis

## Part 4A: Code Review — Junior Developer's Webhook Handler

The code under review:

```javascript
app.post('/webhooks/payment-provider', async (req, res) => {
  const payload = req.body;
  const signature = req.headers['x-webhook-signature'];
  if (!signature) {
    return res.status(401).send('Missing signature');
  }
  const transaction = await db.query(
    'SELECT * FROM transactions WHERE provider_reference = $1',
    [payload.reference]
  );
  if (!transaction.rows[0]) {
    return res.status(404).send('Transaction not found');
  }
  if (payload.status === 'completed') {
    await db.query(
      'UPDATE transactions SET status = $1, completed_at = NOW() WHERE id = $2',
      ['completed', transaction.rows[0].id]
    );
    await db.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [payload.amount, transaction.rows[0].recipient_account_id]
    );
  } else if (payload.status === 'failed') {
    await db.query(
      'UPDATE transactions SET status = $1 WHERE id = $2',
      ['failed', transaction.rows[0].id]
    );
    await db.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [transaction.rows[0].amount, transaction.rows[0].sender_account_id]
    );
  }
  res.status(200).send('OK');
});
```

---

### Issue 1: Signature is checked for presence but never verified

**What:** The code checks `if (!signature)` but never calls any HMAC verification function. Any request with a non-empty `x-webhook-signature` header passes, including one with the value `"fake"`.

**Why it matters in payments:** This is the only authentication mechanism for webhooks. Without verification, any actor who knows the endpoint URL can POST a `completed` status for any transaction and trigger a credit to any account. This is a direct financial fraud vector.

**Fix:** Verify the signature using HMAC-SHA256 over the raw request body (not the parsed JSON object):
```javascript
const expected = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) { ... }
```
Use `timingSafeEqual` to prevent timing attacks.

---

### Issue 2: 404 returned for unknown transaction reference

**What:** Returns `res.status(404)` when the provider reference is not found.

**Why it matters in payments:** Payment providers retry webhooks on non-200 responses. If the webhook arrives before the `POST /payments` response has been written (a real race condition — the provider can call back almost immediately), returning 404 causes the provider to retry indefinitely. Worse, if the transaction is deleted (e.g. test cleanup), you get infinite retries forever.

**Fix:** Always return 200. Log the unrecognised reference and move on. Our implementation does this and also records the event in `webhook_events` for forensic analysis.

---

### Issue 3: No idempotency check — webhook processed multiple times

**What:** If the provider sends the same webhook twice (retries are standard practice), this code will:
- On `completed`: credit the recipient account twice
- On `failed`: restore the sender's funds twice

**Why it matters in payments:** Double-crediting is money creation. A provider sending 3 retries of a `completed` webhook would triple-credit the recipient. This is a critical financial bug.

**Fix:** Use a `webhook_events` table with a `UNIQUE(provider_reference, event_type)` constraint. `INSERT ... ON CONFLICT DO NOTHING` atomically ensures the event is only processed once. Our implementation does this before any business logic runs.

---

### Issue 4: Balance updated directly, not via double-entry ledger

**What:** `UPDATE accounts SET balance = balance + $1` is called directly without any ledger entry.

**Why it matters in payments:** There is no audit record of why the balance changed. If there is a dispute ("I never received this payment"), there is nothing to prove it happened. Financial regulators require an immutable audit trail of every balance movement. There is also no way to run a reconciliation check (`SUM(ledger) === balance`), which means silent corruption could go undetected indefinitely.

**Fix:** Every balance change must be accompanied by an immutable ledger entry insert. The ledger entry drives the balance update (not the other way around). Our `LedgerService` enforces this — no other code path touches `accounts.balance`.

---

### Issue 5: No database transaction — partial updates possible

**What:** The two `db.query` calls (update transaction status, update account balance) run as separate, independent statements. If the process crashes between them, the transaction status is updated but the balance is not (or vice versa).

**Why it matters in payments:** A `completed` status with no corresponding balance credit means the recipient is told they were paid but their account shows no funds. A balance credit with no status update means reconciliation breaks — the ledger says completed but the transaction record says processing.

**Fix:** Wrap all mutations in a single `BEGIN ... COMMIT` database transaction. Our implementation uses TypeORM's `dataSource.transaction()` to enforce this atomicity.

---

### Issue 6: No state transition validation

**What:** The code will set `status = 'completed'` regardless of the current transaction status. A `completed` webhook arriving for a transaction already in `completed` or `reversed` state will be processed again.

**Why it matters in payments:** A transaction that is already `completed` should not be re-processed. Re-processing could cause double-credits or corrupt a manual reversal that ops has already applied.

**Fix:** Validate transitions against a whitelist before doing any writes:
```javascript
const VALID_TRANSITIONS = { processing: ['completed', 'failed'], failed: ['reversed'] };
if (!VALID_TRANSITIONS[current]?.includes(next)) throw new Error('Invalid transition');
```
Our `VALID_TRANSITIONS` constant and `validateTransition()` method enforce this.

---

### Issue 7: `payload.amount` used for recipient credit instead of `transaction.destination_amount`

**What:** On `completed`, the code credits `payload.amount` to the recipient. The payload amount is supplied by the provider and is the destination currency amount, but it has not been validated against what PayRoute calculated.

**Why it matters in payments:** If the provider sends a different amount than agreed (due to their fee deduction, rounding, or a bug), the recipient gets credited the wrong amount. Additionally, `payload.amount` is user-controlled — if signature verification were broken (Issue 1), an attacker could supply any amount.

**Fix:** Use `transaction.destination_amount` (the amount locked at quote time) as the authoritative credit amount. The provider-reported amount can be logged for reconciliation, but the credit should use the amount we calculated.

---

### Issue 8: No raw body preservation — HMAC verification is broken even if implemented

**What:** If Express's body parser runs before the webhook handler, `req.body` is a parsed JavaScript object. HMAC computed over `JSON.stringify(req.body)` will not match the signature computed over the original raw bytes (field order, whitespace, and encoding may differ).

**Why it matters in payments:** Even if you add the HMAC check (Issue 1), it will fail for legitimate webhooks because the bytes don't match. This leads to either disabling signature verification (security hole) or rejecting valid webhooks (operational hole).

**Fix:** Capture the raw bytes before JSON parsing. In our `main.ts`:
```javascript
app.use('/api/webhooks/provider', (req, res, next) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks);
    req.body = JSON.parse(req.rawBody.toString());
    next();
  });
});
```

---

### Issue 9: Signed integer overflow risk with `balance + $1`

**What:** `balance + $1` where `$1 = payload.amount` is a JavaScript number. JavaScript floats have 53-bit precision, meaning amounts above ~9 quadrillion will lose precision silently. More practically, `0.1 + 0.2 === 0.30000000000000004`.

**Why it matters in payments:** A balance of ₦9,007,199,254,740,993 (above `Number.MAX_SAFE_INTEGER`) would silently round to a wrong value. For NGN with millions of transactions, large accounts can plausibly reach this range.

**Fix:** Use PostgreSQL's `NUMERIC` type for all monetary arithmetic and pass amounts as strings. Our schema uses `NUMERIC(20,8)` and our entities type `balance` as `string` to prevent JavaScript from ever doing arithmetic on monetary values.

---

### Issue 10: No webhook event logging before processing

**What:** If the handler throws an exception after updating the transaction but before responding, the webhook is lost — there is no record it was ever received.

**Why it matters in payments:** This means a `completed` status update could be applied but the `200 OK` never sent. The provider retries, hits Issue 3 (no idempotency), and double-credits. Or the credit fails and the provider retries but the transaction is now in a terminal state.

**Fix:** Log the raw event to `webhook_events` as the very first operation — before any validation, before any signature check, before any database mutations. This gives a forensic record regardless of what happens next.

---

### Issue 11: No error handling — unhandled rejections crash the process

**What:** Any `await db.query(...)` that throws (network error, constraint violation, deadlock) will cause an unhandled promise rejection. In Node.js, this terminates the process.

**Why it matters in payments:** A database deadlock on a busy system would crash the webhook handler, causing all in-flight webhooks to be lost and requiring a restart. For a payment system processing thousands of concurrent webhooks, this is a reliability crisis.

**Fix:** Wrap the entire handler body in `try/catch`. Log errors but still return `200 OK` — the provider should not retry due to our internal errors (it has already done its part). Our implementation wraps `processWebhook()` in `.catch()` in the controller.

---

## Part 4B: Failure Scenarios

### Scenario 1: The webhook arrives before `POST /payments` returns

**What happens:** The provider receives our submission and immediately fires a `completed` webhook. Our handler runs `SELECT FROM transactions WHERE provider_reference = $1` but the transaction doesn't exist yet (the DB transaction in `createPayment` hasn't committed).

**How our system handles it:**
The `webhook_events` table logs the raw event via `INSERT ... ON CONFLICT DO NOTHING`. When the lookup returns `null`, we log a warning and return 200. The event is in `webhook_events` with `processed = false`.

**What we would add with more time:** A background reconciliation job that polls `webhook_events WHERE processed = false AND received_at > X minutes ago`, fetches the transaction by `provider_reference`, and retries processing. This closes the gap completely.

---

### Scenario 2: Duplicate webhook (provider retries)

**How our system handles it:**
`INSERT INTO webhook_events ... ON CONFLICT (provider_reference, event_type) DO NOTHING RETURNING *` returns an empty result set for the duplicate. The service detects this and returns immediately without processing. The duplicate is effectively a no-op.

**Reference:** `WebhooksService.processWebhook()` — the `ON CONFLICT DO NOTHING` pattern on line ~60.

---

### Scenario 3: Provider submission times out

**What happens:** `ProviderService.submitPayment()` throws because the HTTP call to the provider times out. The DB transaction has already committed with the sender's debit applied.

**How our system handles it:**
`PaymentsService.createPayment()` wraps the provider call in a `try/catch` outside the DB transaction. If it throws, the transaction remains in `processing` with `providerReference = null`. The sender's funds are held. An error is logged.

**What we would add:** A reconciliation job that finds `transactions WHERE status = 'processing' AND providerReference IS NULL AND createdAt < NOW() - INTERVAL '10 minutes'` and either retries submission or marks as failed and reverses via `LedgerService.createCompensatingEntries()`.

---

### Scenario 4: Two concurrent requests with the same idempotency key

**How our system handles it:**
`IdempotencyInterceptor` attempts `INSERT ... ON CONFLICT DO NOTHING` on the `idempotency_keys` table. Both requests may see no existing record simultaneously, but only one INSERT succeeds. The loser finds the key with no `response_body` yet and enters a polling loop (up to 1.8 seconds). If the winner completes in time, the loser returns the cached response. If not, a `ConflictException` is thrown.

**What we would add:** Redis SETNX for the lock to avoid polling, with the DB table still used for the persistent cache. This would handle the concurrent case more robustly.

---

### Scenario 5: FX quote expires between preview and submission

**What happens:** The user sees the FX rate in the UI, waits 65 seconds, and then clicks Submit. The 60-second quote TTL has expired.

**How our system handles it:**
`FxService.createQuote()` always creates a fresh quote at submission time — we do not reuse the preview quote. The quote is locked in at the moment `POST /payments` is processed, so expiry during the UI delay is not a problem. The PRD's requirement that quote expiry is handled is satisfied by generating the quote server-side at the time of the transaction, not at the time of the preview.

**Frontend UX:** The FX preview in `PaymentForm.tsx` is a debounced live estimate. A note reads "Quote valid for ~60s". In production, we would auto-refresh the preview and prompt re-confirmation if the rate changes by more than 1%.

---

### Scenario 6: Database node fails mid-transaction

**What happens:** The PostgreSQL primary node crashes after the ledger entry is written but before the `accounts.balance` update commits.

**How our system handles it:**
Both writes are in the same `BEGIN ... COMMIT` transaction. PostgreSQL's ACID guarantees mean that if the node crashes before commit, both writes are rolled back via WAL recovery. The account balance and ledger are in consistent state.

**Caveat:** If this happens after the provider has already received and processed the payment, the transaction is lost from our DB but the funds have left. This is resolved by the reconciliation job querying the provider's status API for all payments that were `processing` and have no final status after a timeout.

---

### Scenario 7: The webhook signature is invalid

**How our system handles it:**
1. Raw event is logged to `webhook_events` (always, regardless of signature).
2. HMAC-SHA256 is computed with `timingSafeEqual` to prevent timing attacks.
3. If invalid, `signatureValid = false` is stored on the event and processing stops.
4. Response is still `200 OK` — rejecting with 401 would cause the provider to retry forever.
5. An ops alert (via the error log) notifies the team to investigate.

**Reference:** `WebhooksService.verifySignature()` and the guard logic in `processWebhook()`.

---

## Production Readiness Assessment

### What I would add before going live

1. **Rate limiting** — per account, per IP, to prevent both abuse and runaway bugs that create thousands of payments.
2. **Dead letter queue** — failed webhook events that couldn't be processed after N retries go to a DLQ for manual review.
3. **Distributed locks** — replace the DB-polling idempotency pattern with Redis SETNX for better concurrency handling.
4. **Balance reconciliation cron** — nightly job that runs `SELECT id FROM accounts WHERE balance != (SELECT SUM(amount) FROM ledger_entries WHERE account_id = accounts.id)` and alerts on any discrepancy.
5. **Provider timeout recovery** — scheduled job for `transactions WHERE status = 'processing' AND created_at < NOW() - INTERVAL '1 hour'`.
6. **Structured logging with correlation IDs** — every log line for a given payment should carry the transaction ID, idempotency key, and request ID for tracing.
7. **Encrypted secrets** — `WEBHOOK_SECRET` and DB credentials should come from a secrets manager (AWS Secrets Manager, Vault), not environment variables baked into Docker.
