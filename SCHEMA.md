# Schema Design Document

## Overview

PayRoute uses a PostgreSQL schema structured around seven tables. The design prioritises financial correctness over developer convenience — every tradeoff below reflects that priority.

---

## 1. Why This Structure Over Alternatives

### Separate `accounts` and `ledger_entries` tables

The most common alternative is a single `accounts.balance` column updated directly by each payment operation. We rejected this for two reasons:

- **No audit trail.** A direct `UPDATE accounts SET balance = balance - X` destroys the history. If a bug causes a wrong balance, there is no way to reconstruct what happened.
- **Reconciliation is impossible.** A separate ledger lets us independently verify: `account.balance === SUM(ledger_entries.amount WHERE account_id = X)`. This invariant can be checked at any time and re-run as a cron job.

The approach we use: `accounts.balance` exists as a **cached read optimisation** only. It is always updated by `LedgerService` — the only service in the codebase permitted to write to it — within the same database transaction as the ledger entry insert. If the two ever diverge, the ledger is authoritative.

### Separate `transaction_state_history` table

An alternative is a single `transactions.status` column with `updated_at`. We rejected this because it loses intermediate states. If a payment goes `processing → failed → reversed`, a single column can only show the current state. The state history table preserves every transition with its timestamp and arbitrary metadata (e.g. the webhook event ID that triggered the transition), which is essential for dispute resolution.

### `webhook_events` as an append-first log

We log every inbound webhook payload to `webhook_events` **before** any processing occurs. This is not optional — if the processor crashes after logging but before updating the transaction, the event can be replayed from the log. The `UNIQUE(provider_reference, event_type)` constraint ensures the log itself is idempotent.

### `idempotency_keys` as a database table (not Redis)

Redis-based idempotency is faster but adds operational complexity and introduces a new failure domain. For this system's scale, a PostgreSQL-backed idempotency table with `INSERT ... ON CONFLICT DO NOTHING` provides the same logical guarantee with fewer moving parts. The TTL (`expires_at`) is enforced by a periodic cleanup job; an index on `expires_at` makes this efficient.

### `fx_quotes` stored separately

We could inline the FX rate directly on the transaction. We store it separately because:
- A quote has its own lifecycle (expiry, creation time) independent of whether a transaction was created.
- It allows auditing whether a user was shown the correct rate before confirming.
- Future work could support quote caching (return the same quote for the same pair/amount within its TTL).

---

## 2. How We Ensure No Money Is Created or Destroyed

### The Core Invariant

For every account: `account.balance === SUM(ledger_entries.amount WHERE account_id = X)`

This invariant holds because:

1. `accounts.balance` is **only** written by `LedgerService.debit()` and `LedgerService.credit()`.
2. Both methods write the ledger entry and update the balance **in the same database transaction** (ACID atomicity guarantees both happen or neither happens).
3. The `CHECK(balance >= 0)` constraint on `accounts` prevents overdraft at the database level — even if application logic has a bug.
4. The debit UPDATE uses `WHERE balance >= amount`, providing a second safety net: if two concurrent requests slip through the application-level balance check, the database rejects the one that would cause an overdraft.

### Double-Entry Enforcement

For a cross-currency payment:
- On initiation: `DEBIT sender_NGN_account (-500,000 NGN)` → `accounts.balance` decremented
- On webhook completed: `CREDIT recipient_USD_account (+322.50 USD)` → `accounts.balance` incremented
- On webhook failed: `CREDIT sender_NGN_account (+500,000 NGN)` via compensating entry → `accounts.balance` restored

The compensating entry uses the original debit ledger entry as input (reads `WHERE transaction_id = X AND entry_type = 'debit'`), so the reversal amount is always identical to what was originally debited — there is no possibility of rounding error.

### What We Do Not Model

For simplicity, we do not model the FX provider as an internal account. In a production system, you would also have:
- A PayRoute float account in NGN (credited when sender debits)
- A PayRoute float account in USD (debited when recipient is credited)

This would give true double-entry across all currencies. In the current design, the FX spread sits implicitly in the rate calculation, which is adequate for an assessment but would need addressing before going live.

---

## 3. How to Add a New Currency Pair in Production

Adding a new currency pair is a **data change, not a schema change**.

Steps:
1. Add the rate to the `SIMULATED_RATES` map in `fx.service.ts` (or, in production, to the FX provider's configuration API call).
2. Create accounts for users in the new currency using `INSERT INTO accounts (user_id, currency, balance) VALUES (...)`.
3. No migration required — the `currency` column is `VARCHAR(3)`, which accepts any ISO 4217 code.

If the new currency requires a different decimal precision (e.g., JPY has zero decimal places), you would need to review the `NUMERIC(20,8)` column precision, though this is a safe change. The `CHECK(balance >= 0)` constraint works across all currencies.

For rate management in production: rates should come from a rate provider (not hardcoded). The `fx_quotes` table already supports this — `FxService.createQuote()` just needs to fetch from a live API instead of the static map.

---

## 4. One Thing I Would Do Differently with More Time

**Replace `accounts.balance` with a proper materialised view.**

Currently, `accounts.balance` is a manually maintained cache — `LedgerService` updates it atomically with each ledger write. This works, but it requires discipline: every balance-changing operation must go through `LedgerService` or the cache becomes stale.

With more time I would:
1. Remove `accounts.balance` from the `accounts` table entirely.
2. Create a `MATERIALIZED VIEW account_balances AS SELECT account_id, currency, SUM(amount) AS balance FROM ledger_entries GROUP BY account_id, currency`.
3. Refresh the view after each ledger write (or use a trigger).
4. All balance reads go through the view.

This would make the invariant structural rather than disciplinary — it would be physically impossible to diverge because the balance column does not exist independently of the ledger.

The tradeoff is read performance: `SUM()` on a large ledger table is slower than reading a single column. In practice you would keep the cached column but also maintain the materialised view for reconciliation checks, using the view as the source of truth during nightly reconciliation jobs.
