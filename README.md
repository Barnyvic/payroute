# PayRoute - Cross-Border Payment Processing System

A production-grade payment processing platform that enables Nigerian businesses to send cross-border payments with real-time FX conversion, double-entry ledger accounting, and asynchronous webhook processing.

## 🏗️ Architecture Overview

### System Design Philosophy

This system implements a **financially sound payment processing pipeline** with the following core principles:

1. **Double-Entry Bookkeeping** - Every transaction creates balanced debit/credit pairs
2. **Immutable Ledger** - Ledger entries are append-only; balance changes are never updated in-place
3. **Idempotent Operations** - Duplicate requests (via idempotency keys) return cached responses
4. **State Machine Enforcement** - Transactions follow strict state transitions with audit trails
5. **Webhook Replay Safety** - All webhook events are logged before processing; processing is idempotent

### Tech Stack

**Backend:**
- **NestJS** (TypeScript framework with dependency injection)
- **TypeORM** (database ORM with migration support)
- **PostgreSQL** (transactional database with ACID guarantees)
- **class-validator** (DTO validation)
- **Jest** (testing framework)

**Frontend:**
- **React 18** (UI framework)
- **TypeScript** (type safety)
- **React Query / TanStack Query** (server state management)
- **Tailwind CSS** (utility-first styling)
- **React Router** (client-side routing)
- **Axios** (HTTP client)

**Infrastructure:**
- **Docker & Docker Compose** (containerization)
- **PostgreSQL 15** (database)

---

## 🚀 Quick Start

### Prerequisites

- **Docker** and **Docker Compose** installed
- **Node.js 18+** (for local development)
- **npm** or **yarn**

### Setup Instructions

1. **Clone the repository**
```bash
git clone <repository-url>
cd payroute
```

2. **Create environment files**

**Backend (.env):**
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
# Database
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=payroute
DATABASE_PASSWORD=payroute_secret_123
DATABASE_NAME=payroute_db

# Application
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=your-jwt-secret-change-in-production
WEBHOOK_SECRET=webhook_secret_for_hmac_verification

# FX Provider (simulated)
FX_API_KEY=simulated_key

# Payment Provider (simulated)
PROVIDER_API_URL=http://localhost:3000/simulate/provider
PROVIDER_API_KEY=simulated_provider_key
```

**Frontend (.env):**
```bash
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

3. **Start the application**
```bash
docker-compose up --build
```

This will:
- Build and start the PostgreSQL database
- Run database migrations automatically
- Start the NestJS backend on `http://localhost:3000`
- Start the React frontend on `http://localhost:5173`

4. **Seed the database (optional)**
```bash
docker-compose exec backend npm run seed
```

This creates test accounts with sample balances.

5. **Access the application**
- **Frontend Dashboard:** http://localhost:5173
- **Backend API:** http://localhost:3000/api
- **API Documentation:** http://localhost:3000/api/docs (Swagger)

---

## 📁 Project Structure

```
payroute/
├── backend/                      # NestJS Backend
│   ├── src/
│   │   ├── main.ts              # Application entry point
│   │   ├── app.module.ts        # Root module
│   │   ├── config/              # Configuration management
│   │   │   └── database.config.ts
│   │   ├── database/            # Database setup and migrations
│   │   │   ├── database.module.ts
│   │   │   ├── database.service.ts
│   │   │   └── migrations/      # TypeORM migrations
│   │   │       ├── 1709000001-CreateAccounts.ts
│   │   │       ├── 1709000002-CreateTransactions.ts
│   │   │       ├── 1709000003-CreateLedgerEntries.ts
│   │   │       ├── 1709000004-CreateFxQuotes.ts
│   │   │       ├── 1709000005-CreateWebhookEvents.ts
│   │   │       ├── 1709000006-CreateTransactionStateHistory.ts
│   │   │       └── 1709000007-CreateIdempotencyKeys.ts
│   │   ├── payments/            # Payment module
│   │   │   ├── payments.module.ts
│   │   │   ├── payments.controller.ts
│   │   │   ├── payments.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-payment.dto.ts
│   │   │   │   └── list-payments.dto.ts
│   │   │   └── entities/
│   │   │       └── transaction.entity.ts
│   │   ├── accounts/            # Account management
│   │   │   ├── accounts.module.ts
│   │   │   ├── accounts.service.ts
│   │   │   └── entities/
│   │   │       └── account.entity.ts
│   │   ├── ledger/              # Double-entry ledger
│   │   │   ├── ledger.module.ts
│   │   │   ├── ledger.service.ts
│   │   │   └── entities/
│   │   │       └── ledger-entry.entity.ts
│   │   ├── webhooks/            # Webhook processing
│   │   │   ├── webhooks.module.ts
│   │   │   ├── webhooks.controller.ts
│   │   │   ├── webhooks.service.ts
│   │   │   ├── guards/
│   │   │   │   └── webhook-signature.guard.ts
│   │   │   ├── dto/
│   │   │   │   └── webhook-payload.dto.ts
│   │   │   └── entities/
│   │   │       └── webhook-event.entity.ts
│   │   ├── fx/                  # Foreign exchange
│   │   │   ├── fx.module.ts
│   │   │   ├── fx.service.ts
│   │   │   └── entities/
│   │   │       └── fx-quote.entity.ts
│   │   ├── provider/            # Payment provider integration
│   │   │   ├── provider.module.ts
│   │   │   └── provider.service.ts
│   │   ├── common/              # Shared utilities
│   │   │   ├── guards/
│   │   │   │   └── idempotency.guard.ts
│   │   │   ├── interceptors/
│   │   │   │   └── logging.interceptor.ts
│   │   │   ├── filters/
│   │   │   │   └── http-exception.filter.ts
│   │   │   └── decorators/
│   │   │       └── idempotency-key.decorator.ts
│   │   └── tests/               # E2E tests
│   │       ├── payments.e2e-spec.ts
│   │       └── webhooks.e2e-spec.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   └── Dockerfile
│
├── frontend/                     # React Frontend
│   ├── src/
│   │   ├── main.tsx             # Application entry
│   │   ├── App.tsx              # Root component
│   │   ├── api/                 # API client
│   │   │   ├── client.ts        # Axios instance
│   │   │   └── payments.ts      # Payment API methods
│   │   ├── components/          # React components
│   │   │   ├── Layout.tsx       # Main layout
│   │   │   ├── PaymentForm.tsx  # Payment initiation form
│   │   │   ├── TransactionList.tsx
│   │   │   ├── TransactionDetail.tsx
│   │   │   ├── StatusBadge.tsx  # Status indicator
│   │   │   └── Timeline.tsx     # Transaction timeline
│   │   ├── hooks/               # Custom React hooks
│   │   │   ├── usePayments.ts
│   │   │   └── useAccounts.ts
│   │   ├── pages/               # Page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── NewPayment.tsx
│   │   │   └── TransactionDetails.tsx
│   │   ├── types/               # TypeScript types
│   │   │   └── payment.types.ts
│   │   └── utils/               # Utilities
│   │       ├── formatters.ts    # Currency/date formatting
│   │       └── validators.ts
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
├── SCHEMA.md                     # Database schema documentation
├── ANALYSIS.md                   # Written analysis (4A, 4B, 4C)
└── README.md                     # This file
```

---

## 🗄️ Database Schema

### Core Tables

#### 1. **accounts**
Stores multi-currency account balances.

```sql
- id (UUID, PK)
- user_id (VARCHAR) - External user reference
- currency (VARCHAR(3)) - ISO 4217 currency code
- balance (DECIMAL(20,2)) - Current balance
- version (INT) - Optimistic locking version
- created_at, updated_at (TIMESTAMP)

Indexes:
- UNIQUE(user_id, currency)
- INDEX(currency)

Constraints:
- CHECK(balance >= 0) - No overdrafts
```

#### 2. **transactions**
Payment transaction lifecycle.

```sql
- id (UUID, PK)
- provider_reference (VARCHAR) - External provider ID
- sender_account_id (UUID, FK -> accounts)
- recipient_account_id (UUID, FK -> accounts)
- source_currency (VARCHAR(3))
- source_amount (DECIMAL(20,2))
- destination_currency (VARCHAR(3))
- destination_amount (DECIMAL(20,2))
- fx_rate (DECIMAL(10,6))
- fx_quote_id (UUID, FK -> fx_quotes)
- status (ENUM: initiated, processing, completed, failed, reversed)
- created_at, updated_at, completed_at (TIMESTAMP)

Indexes:
- INDEX(provider_reference)
- INDEX(status, created_at)
- INDEX(sender_account_id)
```

#### 3. **ledger_entries**
Immutable double-entry ledger.

```sql
- id (UUID, PK)
- transaction_id (UUID, FK -> transactions)
- account_id (UUID, FK -> accounts)
- currency (VARCHAR(3))
- amount (DECIMAL(20,2)) - Positive = credit, Negative = debit
- entry_type (ENUM: debit, credit)
- created_at (TIMESTAMP)

Constraints:
- Ledger entries are NEVER updated or deleted
- Each transaction has balanced debit/credit pairs
```

#### 4. **fx_quotes**
Time-bounded exchange rate quotes.

```sql
- id (UUID, PK)
- from_currency (VARCHAR(3))
- to_currency (VARCHAR(3))
- rate (DECIMAL(10,6))
- amount (DECIMAL(20,2))
- expires_at (TIMESTAMP)
- created_at (TIMESTAMP)

Constraints:
- CHECK(expires_at > created_at)
- CHECK(rate > 0)
```

#### 5. **webhook_events**
Raw webhook event log for forensics.

```sql
- id (UUID, PK)
- provider_reference (VARCHAR)
- event_type (VARCHAR) - 'completed', 'failed', etc.
- payload (JSONB) - Full webhook body
- signature (VARCHAR) - HMAC signature received
- received_at (TIMESTAMP)
- processed (BOOLEAN)
- processed_at (TIMESTAMP)

Indexes:
- INDEX(provider_reference, event_type)
- INDEX(processed, received_at)
```

#### 6. **transaction_state_history**
Audit trail for state transitions.

```sql
- id (UUID, PK)
- transaction_id (UUID, FK -> transactions)
- from_state (VARCHAR)
- to_state (VARCHAR)
- timestamp (TIMESTAMP)
- metadata (JSONB) - Additional context

Indexes:
- INDEX(transaction_id, timestamp)
```

#### 7. **idempotency_keys**
Prevent duplicate payment requests.

```sql
- key (VARCHAR, PK)
- response_body (JSONB)
- status_code (INT)
- created_at (TIMESTAMP)
- expires_at (TIMESTAMP)

Constraints:
- TTL: 24 hours (cleanup job removes expired keys)
```

**See [SCHEMA.md](./SCHEMA.md) for detailed design decisions and trade-offs.**

---

## 🔌 API Endpoints

### Base URL
```
http://localhost:3000/api
```

### 1. Create Payment

**POST** `/payments`

Initiate a new cross-border payment.

**Headers:**
```
Content-Type: application/json
Idempotency-Key: <unique-key> (Required)
```

**Request Body:**
```json
{
  "senderId": "acc_123",
  "recipientId": "acc_456",
  "sourceCurrency": "NGN",
  "destinationCurrency": "USD",
  "amount": 500000.00,
  "destinationAmount": null
}
```

**Response:** `201 Created`
```json
{
  "id": "txn_abc123",
  "status": "processing",
  "providerReference": "prov_xyz789",
  "sourceAmount": 500000.00,
  "destinationAmount": 1219.51,
  "fxRate": 410.00,
  "createdAt": "2024-03-05T10:30:00Z"
}
```

**Idempotency Behavior:**
- Same `Idempotency-Key` returns cached response (even if duplicate request arrives mid-flight)
- Different keys for same account may fail with `Insufficient funds`

---

### 2. Get Payment Details

**GET** `/payments/:id`

Retrieve full transaction details.

**Response:** `200 OK`
```json
{
  "id": "txn_abc123",
  "status": "completed",
  "sender": {
    "accountId": "acc_123",
    "currency": "NGN",
    "amount": 500000.00
  },
  "recipient": {
    "accountId": "acc_456",
    "currency": "USD",
    "amount": 1219.51
  },
  "fxRate": 410.00,
  "providerReference": "prov_xyz789",
  "ledgerEntries": [
    {
      "accountId": "acc_123",
      "currency": "NGN",
      "amount": -500000.00,
      "type": "debit",
      "createdAt": "2024-03-05T10:30:00Z"
    },
    {
      "accountId": "acc_456",
      "currency": "USD",
      "amount": 1219.51,
      "type": "credit",
      "createdAt": "2024-03-05T10:35:00Z"
    }
  ],
  "stateHistory": [
    { "from": null, "to": "initiated", "timestamp": "2024-03-05T10:30:00Z" },
    { "from": "initiated", "to": "processing", "timestamp": "2024-03-05T10:30:01Z" },
    { "from": "processing", "to": "completed", "timestamp": "2024-03-05T10:35:00Z" }
  ]
}
```

---

### 3. List Payments

**GET** `/payments`

Paginated transaction list with filters.

**Query Parameters:**
- `status` (optional): `processing`, `completed`, `failed`
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `startDate` (optional): ISO 8601 date
- `endDate` (optional): ISO 8601 date

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "txn_abc123",
      "senderAccountId": "acc_123",
      "recipientAccountId": "acc_456",
      "sourceAmount": 500000.00,
      "sourceCurrency": "NGN",
      "destinationAmount": 1219.51,
      "destinationCurrency": "USD",
      "fxRate": 410.00,
      "status": "completed",
      "createdAt": "2024-03-05T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

---

### 4. Webhook Handler (Provider Callback)

**POST** `/webhooks/provider`

Receives asynchronous status updates from the payment provider.

**Headers:**
```
Content-Type: application/json
X-Webhook-Signature: <HMAC-SHA256-signature>
```

**Request Body:**
```json
{
  "reference": "prov_xyz789",
  "status": "completed",
  "amount": 1219.51,
  "currency": "USD",
  "timestamp": "2024-03-05T10:35:00Z"
}
```

**Response:** `200 OK` (ALWAYS, even for invalid signatures or unknown references)
```json
{
  "received": true
}
```

**Signature Verification:**
```typescript
const signature = HMAC-SHA256(webhookSecret, rawRequestBody);
// Must match X-Webhook-Signature header
```

**Idempotency:**
- Same `reference` + `status` combination is processed only once
- Raw webhook event is logged before processing

---

## 🎨 Frontend Features

### 1. Dashboard (Transaction List)

- **URL:** `/`
- **Features:**
  - Paginated table of all transactions
  - Color-coded status badges:
    - 🟡 **Processing** - Yellow
    - 🟢 **Completed** - Green
    - 🔴 **Failed** - Red
    - ⚫ **Reversed** - Gray
  - Filters: Status, Date Range
  - Real-time updates (polling every 5 seconds for processing transactions)
  - Click row to view details

### 2. Payment Initiation Form

- **URL:** `/payments/new`
- **Features:**
  - Account selection (multi-currency)
  - Recipient input with validation
  - Live FX rate preview
  - Converted amount display
  - Submit button disabled during processing
  - Error handling with user-friendly messages
  - Success notification with transaction reference

### 3. Transaction Detail View

- **URL:** `/payments/:id`
- **Features:**
  - Complete transaction information
  - Visual timeline of state transitions
  - Ledger entry breakdown (debit/credit pairs)
  - Provider reference
  - Copy-to-clipboard for references
  - Refresh button for latest status

---

## 🧪 Testing

### Backend Tests

**Run unit tests:**
```bash
cd backend
npm test
```

**Run E2E tests:**
```bash
npm run test:e2e
```

**Critical test scenarios:**
1. ✅ Concurrent payment requests with same idempotency key
2. ✅ Concurrent payment requests with different keys (insufficient funds)
3. ✅ Webhook idempotency (duplicate webhook events)
4. ✅ Invalid webhook signatures
5. ✅ State transition validation
6. ✅ Ledger balance integrity

### Frontend Tests

```bash
cd frontend
npm test
```

---

## 🔒 Security Considerations

### Implemented

1. **HMAC Webhook Verification** - Prevents webhook spoofing
2. **Idempotency Keys** - Prevents duplicate charges
3. **Row-Level Locking** - Prevents race conditions
4. **Input Validation** - class-validator on all DTOs
5. **CORS Configuration** - Restricts allowed origins
6. **SQL Injection Protection** - Parameterized queries (TypeORM)

### Production Additions (See ANALYSIS.md)

- Rate limiting (per IP, per account)
- API key authentication
- Audit logging (who, what, when)
- Encrypted secrets (Vault, KMS)
- TLS/SSL termination
- DDoS protection

---

## 🚨 Failure Handling

### 1. Double-Spend Prevention

**Problem:** Two concurrent requests for the same account.

**Solution:**
```typescript
// Pessimistic locking with NOWAIT
const account = await manager
  .createQueryBuilder(Account, 'account')
  .where('account.id = :id', { id: senderId })
  .setLock('pessimistic_write', undefined, ['nowait'])
  .getOne();
```

- First request acquires lock
- Second request fails immediately with "Resource locked" error
- Client retries with exponential backoff

### 2. Webhook Before API Response

**Problem:** Provider webhook arrives before `POST /payments` returns.

**Solution:**
- Webhook handler checks transaction status
- If transaction doesn't exist yet → log event, skip processing
- Background job retries unprocessed events after 1 minute

### 3. Stale FX Quote

**Problem:** User confirms payment after quote expires.

**Solution:**
```typescript
if (fxQuote.expiresAt < new Date()) {
  throw new BadRequestException('FX quote expired - please refresh');
}
```

- Quotes expire after 60 seconds
- Frontend auto-refreshes quote every 30 seconds
- User must re-confirm if quote changes >1%

### 4. Partial Settlement / Reversal

**Problem:** Provider reports success, but recipient bank rejects 2 days later.

**Solution:**
- Manual reversal flow (admin API)
- Creates compensating ledger entries:
  ```
  Debit recipient: -$100 USD
  Credit sender: +₦41,000 NGN (at reversal date rate)
  ```
- Transaction status → `reversed`
- Audit trail preserved

### 5. Provider Timeout

**Problem:** HTTP call to provider times out (don't know if they received it).

**Solution:**
- Store transaction as `processing` with `provider_reference = null`
- Background job polls provider status API every 5 minutes
- After 1 hour with no response → mark as `failed`, reverse funds
- If provider later confirms → handle via webhook (idempotent)

**See [ANALYSIS.md](./ANALYSIS.md) for detailed failure scenario analysis.**

---

## 📊 Monitoring & Observability

### Key Metrics (Production)

1. **Transaction Success Rate** - `completed / (completed + failed)`
2. **Webhook Processing Latency** - Time from received → processed
3. **Ledger Balance Integrity** - `SUM(ledger_entries) = SUM(account.balance)`
4. **Idempotency Key Hit Rate** - Duplicate request detection
5. **Provider Timeout Rate** - Payment submission failures

### Logging

All critical operations are logged:
- Payment initiation (with idempotency key)
- Account locking attempts
- Ledger entry creation
- Webhook receipt (before processing)
- State transitions

**Log Format:**
```json
{
  "timestamp": "2024-03-05T10:30:00Z",
  "level": "info",
  "service": "payments",
  "transaction_id": "txn_abc123",
  "event": "payment_initiated",
  "idempotency_key": "key_xyz",
  "amount": 500000.00,
  "currency": "NGN"
}
```

---

## 🔄 Development Workflow

### Running Locally (Without Docker)

**Backend:**
```bash
cd backend

# Install dependencies
npm install

# Start PostgreSQL (via Docker)
docker run -d \
  -e POSTGRES_USER=payroute \
  -e POSTGRES_PASSWORD=payroute_secret_123 \
  -e POSTGRES_DB=payroute_db \
  -p 5432:5432 \
  postgres:15

# Run migrations
npm run migration:run

# Start development server
npm run start:dev
```

**Frontend:**
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Database Migrations

**Create a new migration:**
```bash
cd backend
npm run migration:create -- CreateNewTable
```

**Run migrations:**
```bash
npm run migration:run
```

**Revert last migration:**
```bash
npm run migration:revert
```

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to database"

**Solution:**
```bash
# Check if PostgreSQL is running
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres

# Restart services
docker-compose restart
```

### Issue: "Idempotency key already used"

**Explanation:** This is expected behavior. The same idempotency key returns the cached response.

**Solution:**
- Use a new UUID for each payment attempt
- Frontend generates: `crypto.randomUUID()`

### Issue: "Insufficient funds" but balance looks correct

**Solution:**
- Check for concurrent transactions locking funds
- Query ledger entries:
  ```sql
  SELECT * FROM ledger_entries 
  WHERE account_id = 'acc_123' 
  ORDER BY created_at DESC;
  ```

### Issue: Webhook not processing

**Solution:**
```bash
# Check webhook events table
docker-compose exec postgres psql -U payroute -d payroute_db -c \
  "SELECT * FROM webhook_events WHERE processed = false;"

# Verify webhook secret matches
echo $WEBHOOK_SECRET

# Check backend logs
docker-compose logs backend | grep webhook
```

---

##  Environment Variables

### Backend

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_HOST` | PostgreSQL host | Yes | - |
| `DATABASE_PORT` | PostgreSQL port | Yes | 5432 |
| `DATABASE_USER` | Database user | Yes | - |
| `DATABASE_PASSWORD` | Database password | Yes | - |
| `DATABASE_NAME` | Database name | Yes | - |
| `PORT` | Backend server port | No | 3000 |
| `NODE_ENV` | Environment | No | development |
| `WEBHOOK_SECRET` | HMAC webhook secret | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |

### Frontend

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_API_BASE_URL` | Backend API URL | Yes | - |

---

##  Design Decisions

### Why TypeORM Instead of Raw SQL?

- **Faster development** - Migrations and entities auto-generate
- **Type safety** - Compile-time checks for query parameters
- **NestJS integration** - First-class support

**Trade-off:** Less SQL visibility. Mitigated by:
- Enabling query logging in development
- Using QueryBuilder for complex queries
- Writing raw SQL for critical money operations

### Why SERIALIZABLE Isolation Level?

**Problem:** Two concurrent requests with same idempotency key might both proceed.

**Solution:** SERIALIZABLE isolation prevents phantom reads.

**Alternative:** READ COMMITTED + explicit locking. Chose SERIALIZABLE for simplicity in a take-home assignment.

### Why Store Raw Webhook Events?

**Problem:** Provider sends malformed webhook, our processor crashes.

**Solution:**
- Log raw payload BEFORE processing
- Can replay events from database
- Forensic analysis for disputes

### Why Immutable Ledger Entries?

**Problem:** Updating balances directly loses audit trail.

**Solution:**
- Ledger entries are append-only
- Account balance = `SUM(ledger_entries.amount)`
- Can rebuild balances from ledger at any point in time

---

##  Additional Documentation

- **[SCHEMA.md](./SCHEMA.md)** - Detailed database schema design
- **[ANALYSIS.md](./ANALYSIS.md)** - Code review, failure scenarios, production readiness

---

##  Contributing

This is a take-home assignment, not accepting external contributions.

---

## License

Proprietary - PayRoute Assessment Project

---

##  Implementation Checklist

### Backend
- [x] NestJS project setup
- [x] TypeORM configuration
- [x] Database migrations (7 tables)
- [x] Account entity with balance tracking
- [x] Transaction entity with state machine
- [x] Ledger entry entity (immutable)
- [x] FX quote entity with expiry
- [x] Webhook event logging
- [x] Idempotency guard implementation
- [x] POST /payments with row locking
- [x] GET /payments/:id with ledger entries
- [x] GET /payments with pagination/filters
- [x] POST /webhooks/provider with HMAC verification
- [x] Webhook idempotency handling
- [x] State transition validation
- [x] Compensating entries for failures
- [x] Unit tests for payment service
- [x] E2E tests for critical paths

### Frontend
- [x] React + TypeScript + Vite setup
- [x] Tailwind CSS configuration
- [x] Axios API client
- [x] React Query integration
- [x] Transaction list component
- [x] Status badge component
- [x] Payment form with validation
- [x] FX quote preview
- [x] Transaction detail view
- [x] Timeline component
- [x] Error handling
- [x] Loading states
- [x] Responsive design

### Infrastructure
- [x] Docker Compose configuration
- [x] PostgreSQL container
- [x] Backend Dockerfile
- [x] Frontend Dockerfile
- [x] Environment variable setup
- [x] Database seeding script

### Documentation
- [x] README.md (this file)
- [x] SCHEMA.md (database design document)
- [x] ANALYSIS.md (written analysis)

---
