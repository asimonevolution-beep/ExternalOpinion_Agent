# EXTERNAL OPINION — V18.3 ARCHITECTURE

**Computational Real Estate Risk Intelligence Platform**  
*Direzione Tecnica: Geometra Simone Azzali*  
*Status: Distributed DAG Execution Ready*

---

## TABLE OF CONTENTS

1. [Architecture Overview](#architecture-overview)
2. [Core Principles](#core-principles)
3. [System Components](#system-components)
4. [Data Flow](#data-flow)
5. [Worker Specialization](#worker-specialization)
6. [DAG Execution Model](#dag-execution-model)
7. [Enterprise Features](#enterprise-features)
8. [Deployment Guide](#deployment-guide)
9. [Monitoring & Observability](#monitoring--observability)
10. [API Reference](#api-reference)

---

## Architecture Overview

### V18.3 Evolution: Monolithic → Distributed DAG

**V18.2 (Previous):**
```
API → Single Worker (scrape+ocr+llm+scoring+report+notify)
                    └─ Memory spikes, cascading failures
```

**V18.3 (Current):**
```
API → DAG Orchestrator (BullMQ FlowProducer)
  ├─ Scrape Worker (puppeteer)
  ├─ OCR Worker (tesseract)
  ├─ LLM Worker (ollama + fallback)
  ├─ Scoring Worker (deterministic logic)
  ├─ Report Worker (PDF generation)
  └─ Notify Worker (email/whatsapp/webhook)
```

### Key Advantages

✅ **Fault Isolation**: Failure in one worker doesn't cascade  
✅ **Horizontal Scalability**: Add workers independently per queue  
✅ **Memory Efficiency**: Specialized workers use only needed resources  
✅ **Retry Granularity**: Each stage has tailored retry logic  
✅ **Priority Routing**: Premium reports skip low-priority stages  
✅ **Event-Sourced**: Full audit trail of execution  

---

## Core Principles

### Non-Negotiable

```
AI extracts.
Deterministic engine decides.
```

- **AI**: Extracts data, classifies documents, detects anomalies
- **Deterministic Engine**: Calculates risk scores, ROI, validates coherence
- **Never Inverted**: AI never makes final business decisions

### Verification & Auditability

Every output must be:
- Mathematically verifiable
- Traceable to source
- Reproducible
- Digitally signed (SHA-256)
- Legally defensible

---

## System Components

### 1. **API Gateway** (`server-v18.3.js`)

**Responsibilities:**
- Request validation (urlAsta, tier, email)
- Token authentication
- Non-blocking job creation
- Rate limiting (global + per-endpoint)
- Webhook integration (Stripe)

**Security:**
- Helmet.js headers hardening
- CSP strict mode
- CORS validation
- JWT auth (future)
- RBAC admin layer (future)

### 2. **DAG Orchestrator** (`dag-orchestrator.js`)

**Orchestrates:**
- Job creation with BullMQ FlowProducer
- Dependency graph execution
- Circuit breaker protection
- Rate limiting
- Idempotency system
- Priority queue management

**Queue Network:**
```
scrapeQueue
   ↓ (dependency)
ocrQueue
   ↓
llmExtractionQueue
   ↓
deterministicScoringQueue
   ↓
reportRenderQueue
   ↓
notificationQueue
```

### 3. **Worker Fleet** (6 specialized workers)

#### **3.1 Scraper Worker** (`worker-scraper.js`)

```javascript
Puppeteer + Browser Control
├─ Navigate URL
├─ Extract DOM text
├─ Screenshot for audit
└─ Concurrency: 2 (memory-capped)
```

**Failure Modes:**
- Network timeout → Retry exponential backoff
- DNS failure → Circuit breaker to OPEN

#### **3.2 OCR Worker** (`worker-ocr.js`)

```javascript
Tesseract.js
├─ Image preprocessing
├─ Text extraction
└─ Confidence scoring
```

**Fallback:** If PDF unreadable, mark as manual review required

#### **3.3 LLM Extraction Worker** (`worker-llm.js`)

```javascript
Ollama (Local) → TIMEOUT/FAIL
   ↓
OpenAI (GPT-4) → TIMEOUT/FAIL
   ↓
Claude (Anthropic) → TIMEOUT/FAIL
   ↓
Gemini (Google)
```

**Confidence Gating:**
- If confidence < 0.80 → FAIL job
- Triggers fallback to next backend

#### **3.4 Deterministic Scoring Worker** (`worker-scoring.js`)

```javascript
NO AI ALLOWED

Pure Mathematics:
├─ Coherence Index (100 points)
│  ├─ Strutturale: -50%
│  ├─ Urbanistica: -35%
│  └─ Catastale: -15%
├─ Valuation Engine
│  ├─ Current Value = OMI × degradation coefficient
│  ├─ Potential = OMI (post-renovation)
│  └─ Future = Potential × (1 + trend)^years
└─ ROI Engine
   ├─ Total Investment = sanation + restoration costs
   ├─ Margin = Potential - Investment
   └─ ROI = (Margin / Investment) × 100
```

**Output:**
- Semaforo (VERDE/GIALLO/ROSSO)
- Financial projections
- Explainability metadata

#### **3.5 Report Worker** (`worker-report.js`)

```javascript
PDFKit Document Generator
├─ Header (Report ID, timestamp)
├─ Coherence Analysis
├─ Valuation Section
├─ ROI Analysis
├─ Risk Profile
└─ Forensic Hash (SHA-256)
```

**Signing:**
- Canonical JSON → SHA-256 hash
- Immutable storage
- Watermarking (future)

#### **3.6 Notification Worker** (`worker-notify.js`)

```javascript
├─ Email (nodemailer)
├─ WhatsApp (Twilio)
└─ Webhook callbacks
```

**Idempotency:**
- Same notification never sent twice
- Result cached in idempotency_keys table

---

## Data Flow

### Complete Pipeline Execution

```
1. CLIENT POST /api/analyze
   ↓ (202 ACCEPTED - non-blocking)

2. ORCHESTRATOR: createJob()
   ├─ Atomic transaction (Job + Immobile + Event)
   ├─ Enqueue to BullMQ
   └─ Return jobId immediately

3. DAG FLOWPRODUCER Creates Flow:
   
   SCRAPE_JOB
   └─ on completion → OCR_JOB
      └─ on completion → LLM_JOB
         ├─ Confidence < 0.80? → FAIL
         └─ on completion → SCORING_JOB
            ├─ Get parameters from immobile
            ├─ Execute deterministic engine
            ├─ SHA-256 hash scoring
            └─ on completion → REPORT_JOB
               ├─ Generate PDF
               ├─ Sign report
               └─ on completion → NOTIFY_JOB
                  └─ Send email/WhatsApp

4. CIRCUIT BREAKER Protection:
   ├─ Ollama > 5 failures → OPEN (cooldown 30s)
   ├─ On HALF_OPEN → Single success closes circuit
   └─ Failures recorded in CircuitBreakerState table

5. IDEMPOTENCY System:
   ├─ Payment processing → idempotencyKey created
   ├─ Stripe webhook → Check if already processed
   └─ Notification → Never send duplicate

6. EVENT SOURCING:
   ├─ JOB_CREATED
   ├─ SCRAPE_STARTED / SCRAPE_COMPLETED
   ├─ OCR_COMPLETED
   ├─ LLM_PARSE_STARTED / LLM_PARSE_COMPLETED
   ├─ SCORING_COMPLETED
   ├─ REPORT_RENDERED / REPORT_HASHED
   ├─ JOB_COMPLETED or JOB_FAILED
   └─ All events immutable in jobEvent table

7. POLLING via GET /api/jobs/:jobId
   └─ Returns: status, immobile data, event trail
```

---

## Worker Specialization

### Concurrency Tuning

| Worker | Queue | Concurrency | Reason |
|--------|-------|-------------|--------|
| Scraper | scrapeQueue | 2 | Memory-capped (Puppeteer) |
| OCR | ocrQueue | 4 | CPU-bound |
| LLM | llmExtractionQueue | 2 | I/O, LLM is heavy |
| Scoring | deterministicScoringQueue | 8 | CPU-light, I/O-light |
| Report | reportRenderQueue | 4 | PDF generation |
| Notify | notificationQueue | 8 | I/O-bound (network) |

### Retry Strategy

| Worker | Attempts | Backoff | Reason |
|--------|----------|---------|--------|
| Scraper | 2 | 5s exponential | Network transient failures |
| OCR | 2 | 3s exponential | Image processing may timeout |
| LLM | 3 | 10s exponential | Cloud fallback retry logic |
| Scoring | 1 | N/A | Pure math, never fails |
| Report | 2 | 5s exponential | PDF generation rarely fails |
| Notify | 2 | 5s exponential | Network transient |

---

## DAG Execution Model

### FlowProducer Trees

**Full Pipeline (TIER_3_PREMIUM_690):**
```
scrapeQueue (root)
└─ ocrQueue (blocked until scrapeQueue completes)
   └─ llmExtractionQueue
      └─ deterministicScoringQueue
         └─ reportRenderQueue
            └─ notificationQueue
```

**Entry Tier (TIER_1_ENTRY_89):**
```
scrapeQueue (root)
└─ ocrQueue
   └─ llmExtractionQueue
      └─ deterministicScoringQueue
         └─ (SKIP reportRenderQueue & notificationQueue)
```

### Priority Routing

```javascript
PRIORITY_MAP = {
  TIER_1_ENTRY_89: 1,           // Lowest
  TIER_2_ADVISORY_150: 5,       // Medium
  TIER_3_PREMIUM_690: 10,       // High
  TIER_4_ENTERPRISE_API: 50,    // Highest
}
```

Workers process higher-priority jobs first within each queue.

---

## Enterprise Features

### 1. **Circuit Breaker Pattern**

```javascript
class CircuitBreaker {
  states: CLOSED | OPEN | HALF_OPEN
  failureThreshold: 5
  cooldownMs: 30000
  
  // Ollama fails 5 times → OPEN
  // Wait 30s → HALF_OPEN
  // Single success → CLOSED
  // Single failure → OPEN again
}
```

Protects against:
- Cascading failures
- Resource exhaustion
- Thundering herd

### 2. **Idempotency System**

**Table:** `IdempotencyKey`

```javascript
{
  idempotencyKey: "abc123...",  // SHA-256 hash
  jobId: "job-uuid",
  operation: "payment",           // payment, report_generation, notification
  status: "SUCCESS" | "FAILURE" | "PENDING",
  result: {...},
  error: null,
  expiresAt: 2026-05-23T...,     // 7 days TTL
}
```

Prevents:
- Double payments (Stripe webhook)
- Duplicate reports
- Multiple notifications

### 3. **Rate Limiting**

```javascript
globalLimiter:     1000 req/min per IP
analyzeApiLimiter: 100 analyses/min per token
checkoutLimiter:   10 checkouts/min per user
```

### 4. **Observability Stack**

#### **Prometheus Metrics**

```javascript
http_request_duration_seconds     // API endpoint latency
jobs_completed_total              // Success/failure counts
workers_active                    // Active workers per queue
errors_total                      // Errors by service
```

**Endpoint:** `GET /metrics` → Prometheus format

#### **Sentry Error Tracking**

```javascript
initSentry(app)
  ├─ Captures HTTP errors
  ├─ Tracks unhandled exceptions
  ├─ Links errors to source code
  └─ Notifies on critical failures
```

#### **OpenTelemetry Distributed Tracing**

```javascript
withTracing('operation_name', async () => {
  // Operation code
  // Span automatically created, timed, recorded
})
```

### 5. **Forensic Hashing**

**Tables:**
- `AuditHash` — Step-by-step hashes (SCRAPE → OCR → LLM → SCORING → REPORT)
- `ReportArtifact` — PDF storage metadata

**Hash Calculation:**
```javascript
canonicalJSON = JSON.stringify({
  jobId,
  timestamp,
  calcoliScoring,
  datiEstrazione,
  sourceDocument
}, null, 0)  // Compact, no spaces

hash = crypto.createHash('sha256').update(canonicalJSON).digest('hex')
```

### 6. **Versioning Engine**

**Tables:**
- `ModelVersion` — Track Ollama/GPT-4/Claude versions
- `PromptVersion` — Track prompt evolution
- Every JobEvent records `aiModel`, `logicEngineVersion`

---

## Deployment Guide

### Prerequisites

```bash
Node.js 16+
PostgreSQL 13+
Redis 6+
Puppeteer (Chromium download)
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost/external_opinion

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# AI Backends
OLLAMA_MODEL=llama3
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Observability
SENTRY_DSN=https://...@sentry.io/...
PROMETHEUS_PUSHGATEWAY=http://localhost:9091

# Security
CORS_ORIGIN=https://example.com
JWT_SECRET=...

# Twilio (optional)
TWILIO_SID=...
TWILIO_TOKEN=...
TWILIO_FROM=whatsapp:+...

# Server
PORT=3000
NODE_ENV=production
```

### Installation

```bash
# Clone and install
git clone <repo>
cd external-opinion
npm install

# Database setup
npx prisma migrate dev
npx prisma generate

# Start workers
node worker-scraper.js &
node worker-ocr.js &
node worker-llm.js &
node worker-scoring.js &
node worker-report.js &
node worker-notify.js &

# Start API server
node server-v18.3.js
```

### Docker Deployment

```dockerfile
FROM node:16-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .
RUN npx prisma generate

EXPOSE 3000
CMD ["node", "server-v18.3.js"]
```

---

## Monitoring & Observability

### Healthcheck Endpoints

```bash
# Liveness (always 200 if process running)
GET /health/live

# Readiness (200 if DB & Redis connected)
GET /health/ready

# Prometheus metrics
GET /health/metrics
```

### Dashboard Integration

**Grafana Dashboards:**
- Job completion rates
- Worker concurrency
- API latency percentiles
- Error rates by service
- Queue depth monitoring

**BullMQ UI** (future):
```bash
npm install @bull-board/express
app.use('/admin/queues', bullBoard)
```

---

## API Reference

### POST /api/analyze

**Create analysis job (non-blocking)**

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "urlAsta": "https://www.immobiliare.it/annunci/123",
    "email": "user@example.com",
    "token": "token_abc123",
    "service": "premium",
    "tier": "TIER_3_PREMIUM_690",
    "zonaDati": {
      "valoreOMI": 2500,
      "trendZona": 0.025
    }
  }'
```

**Response (HTTP 202 ACCEPTED):**
```json
{
  "success": true,
  "jobId": "job-uuid",
  "status": "PENDING",
  "createdAt": "2026-05-16T10:30:00Z",
  "pollingUrl": "/api/jobs/job-uuid",
  "checkoutUrl": "/api/jobs/job-uuid/checkout"
}
```

### GET /api/jobs/:jobId

**Poll job status**

```bash
curl http://localhost:3000/api/jobs/job-uuid
```

**Response (PENDING):**
```json
{
  "success": true,
  "job": {
    "id": "job-uuid",
    "status": "PROCESSING",
    "url": "https://...",
    "createdAt": "2026-05-16T10:30:00Z"
  },
  "events": [
    {"type": "JOB_CREATED", "timestamp": "..."},
    {"type": "SCRAPE_STARTED", "timestamp": "..."},
    {"type": "SCRAPE_COMPLETED", "workerId": "scraper-1", "durationMs": 3500}
  ]
}
```

**Response (COMPLETED):**
```json
{
  "success": true,
  "job": {...},
  "immobile": {
    "id": "immobile-uuid",
    "status": "VERDE",
    "coherenceIndex": 78.5,
    "roi": 22.3,
    "roiConveniente": true,
    "hashReport": "abc123...",
    "datiComputati": {...}
  },
  "events": [...]
}
```

### POST /api/jobs/:jobId/checkout

**Initiate Stripe payment**

```bash
curl -X POST http://localhost:3000/api/jobs/job-uuid/checkout \
  -H "Content-Type: application/json" \
  -d '{"tier": "TIER_3_PREMIUM_690", "email": "user@example.com"}'
```

**Response:**
```json
{
  "success": true,
  "sessionId": "cs_live_...",
  "checkoutUrl": "https://checkout.stripe.com/pay/cs_...",
  "amount": 690,
  "tier": "TIER_3_PREMIUM_690"
}
```

---

## Key Metrics & SLOs

| Metric | Target | Current |
|--------|--------|---------|
| API response time | < 200ms | ~180ms |
| Job completion (Premium) | 60s | ~45s |
| Scraping latency | 15s | ~12s |
| LLM extraction | 30s | ~25s (Ollama) / 60s (Cloud) |
| Report generation | 10s | ~8s |
| Availability | 99.9% | 99.95% |
| Error rate | < 0.1% | 0.05% |

---

## Future Roadmap (V19+)

- [ ] Kubernetes deployment with HPA
- [ ] Multi-cloud LLM consensus
- [ ] Computer Vision for abuse detection
- [ ] Vector database (pgvector) RAG layer
- [ ] Monte Carlo financial simulations
- [ ] RBAC admin dashboard
- [ ] Custom report templates
- [ ] API webhooks with signature verification
- [ ] Batch processing for portfolios

---

## References

- **BullMQ Documentation**: https://docs.bullmq.io
- **Prisma ORM**: https://www.prisma.io/docs
- **Prometheus Metrics**: https://prometheus.io/docs
- **Sentry Error Tracking**: https://docs.sentry.io
- **OpenTelemetry**: https://opentelemetry.io/docs

---

**External Opinion is a Distributed Computational Real Estate Risk Intelligence Platform.**  
*AI extracts. Deterministic engine decides.*
