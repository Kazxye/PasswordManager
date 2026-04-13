# 🔐 VaultKeeper

**A zero-knowledge password manager where the server never sees your passwords.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

VaultKeeper implements the same cryptographic patterns used by industry leaders like Bitwarden and 1Password — client-side key derivation, authenticated encryption, and a server that stores only opaque, encrypted blobs. Even if the database is fully compromised, an attacker gets nothing usable.

---

## Cryptographic Pipeline

```
master_password + email
        │
        ▼
   salt = SHA256(email.lowercase())
        │
        ▼
   Argon2id(password, salt, mem=64MB, iter=3, par=4)
        │
        ▼
   master_key (512 bits)
        │
        ├──► HKDF-SHA256(info="auth") ──► auth_key (256 bits)
        │         Sent to server → stored as Argon2id(auth_key)
        │
        └──► HKDF-SHA256(info="enc")  ──► enc_key (256 bits)
                  Never leaves the browser → AES-256-GCM encryption
```

The server performs a **second Argon2id hash** on the `auth_key` before storing it — defense in depth. Even with full database access, an attacker must crack two independent Argon2id layers.

Each vault entry is encrypted as a single JSON blob `{title, username, password, url, notes}` with a **unique random 96-bit IV**. Vault names are also encrypted — the server has zero visibility into user data.

---

## Security Model

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Database compromise | Zero-knowledge: server stores only encrypted blobs | ✅ |
| Brute force (master password) | Argon2id 64MB makes each attempt ~0.5s | ✅ |
| Brute force (login) | Redis rate limiting: 5 attempts / 15 min per IP | ✅ |
| JWT hijacking | 15 min TTL + HTTPS + refresh token rotation | ✅ |
| XSS → steal refresh token | HttpOnly / Secure / SameSite=Strict cookie | ✅ |
| XSS → extract encryption key | `enc_key` stored as non-extractable `CryptoKey` | ✅ |
| CSRF | SameSite=Strict cookies + JWT in Authorization header | ✅ |
| Man-in-the-middle | HTTPS enforced via HSTS (1 year max-age) | ✅ |
| Session fixation | Refresh token rotation on every use | ✅ |
| Stale sessions | One active session per user; new login invalidates previous | ✅ |
| Idle exposure | Auto-lock after 5 min inactivity; `beforeunload` wipes keys | ✅ |
| SQL injection | Parameterized queries (SQLAlchemy) + Pydantic validation | ✅ |

**Penetration tested** with an automated test suite covering rate limiting, SQL injection, JWT forgery, token replay, ownership bypass, and security header verification. See [`pentest.sh`](pentest.sh).

---

## Tech Stack

### Backend

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI + Uvicorn (async) |
| Database | PostgreSQL 16 |
| Cache / Sessions | Redis 7 (JWT blacklist, rate limiting, refresh tokens) |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic (auto-runs on container startup) |
| Auth hashing | Argon2id (argon2-cffi) — server-side second hash |
| JWT | python-jose (15 min access + 7 day refresh rotation) |

### Frontend

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript 5.5 |
| Build | Vite |
| Crypto | Web Crypto API + argon2-browser (WASM) |
| State | Zustand (keys live in memory only, never persisted) |
| HTTP | Axios (automatic 401 → refresh interceptor) |
| Animations | Framer Motion + GSAP |
| Styling | Tailwind CSS 4 |

### Infrastructure

| Component | Technology |
|-----------|-----------|
| Orchestration | Docker Compose (4 services) |
| Reverse proxy | Nginx (TLS termination + security headers) |
| TLS | OpenSSL self-signed (dev) / Let's Encrypt (prod) |

---

## Features

- **Zero-knowledge encryption** — all crypto happens client-side via Web Crypto API
- **Argon2id key derivation** — 64MB memory-hard, GPU/ASIC resistant, runs as WASM in the browser
- **AES-256-GCM** — authenticated encryption with unique random IV per entry
- **Non-extractable CryptoKey** — `enc_key` cannot be exported back to JS after derivation
- **Automatic token rotation** — refresh tokens rotate on every use, one session per user
- **Rate limiting** — Redis-based, per-IP (login: 5/15min, register: 3/hr, API: 100/min)
- **Auto-lock** — session locks after 5 min inactivity; encryption key wiped on tab close
- **Audit logging** — every auth event and vault action recorded with IP + user agent
- **Password generator** — cryptographically secure (rejection sampling against modulo bias)
- **Decrypt reveal animation** — passwords visually decrypt character-by-character when revealed
- **Interactive particle background** — canvas-based constellation network with mouse reactivity

---

## Getting Started

### Prerequisites

- Docker + Docker Compose
- Node.js 18+ and pnpm (for frontend development)
- OpenSSL (for generating dev TLS certificates)

### Quick Start

```bash
# Clone
git clone https://github.com/Kazxye/PasswordManager.git
cd PasswordManager

# Generate self-signed TLS certificates (dev only)
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/CN=localhost"

# Copy environment template
cp backend/.env.example backend/.env

# Start all services (Postgres, Redis, API, Nginx)
docker compose up -d

# The API runs Alembic migrations automatically on startup.
# Wait ~15 seconds, then verify:
docker compose logs api | grep "Running upgrade"

# Start the frontend dev server
cd frontend
pnpm install
pnpm dev
```

Open `https://localhost:5173` (Vite) or `https://localhost` (via Nginx).

### Environment Variables

See [`backend/.env.example`](backend/.env.example) for all required variables:

```env
DATABASE_URL=postgresql+asyncpg://vaultkeeper:vaultkeeper_dev_2024@postgres:5432/vaultkeeper
REDIS_URL=redis://redis:6379/0
JWT_SECRET=<generate-a-strong-secret>
API_ENV=development
CORS_ORIGINS=https://localhost:5173,https://localhost
```

---

## Project Structure

```
PasswordManager/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan
│   │   ├── config.py            # pydantic-settings (env vars)
│   │   ├── database.py          # async SQLAlchemy engine
│   │   ├── models/              # User, Vault, Entry, AuditLog
│   │   ├── schemas/             # Pydantic request/response + validators
│   │   ├── routers/             # auth, vaults, entries, audit
│   │   ├── services/            # business logic layer
│   │   ├── middleware/          # rate limiter, request ID
│   │   ├── dependencies/        # get_current_user, get_db
│   │   └── utils/               # security helpers, Redis client
│   ├── alembic/                 # database migrations
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── crypto/              # Argon2id WASM, HKDF, AES-256-GCM
│       ├── api/                 # Axios client + interceptors
│       ├── stores/              # Zustand (auth + vault state)
│       ├── hooks/               # useAutoLock, useCrypto
│       ├── pages/               # Landing, Login, Register, VaultList, EntryDetail
│       └── components/          # PasswordGenerator, StrengthMeter, ProtectedRoute
├── nginx/
│   ├── nginx.conf               # TLS, security headers, proxy_pass
│   └── ssl/                     # certificates (gitignored)
├── docker-compose.yml
├── pentest.sh                   # automated security test suite
└── ARCHITECTURE.md              # detailed implementation spec
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/register` | Create account (email + auth_key) |
| `POST` | `/api/v1/auth/login` | Authenticate → JWT + refresh cookie |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh token → new JWT |
| `POST` | `/api/v1/auth/logout` | Revoke tokens, blacklist JWT |

### Vaults (requires JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/vaults/` | List user's vaults (encrypted names) |
| `POST` | `/api/v1/vaults/` | Create vault |
| `PUT` | `/api/v1/vaults/:id` | Update vault name |
| `DELETE` | `/api/v1/vaults/:id` | Delete vault + cascade entries |

### Entries (requires JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/vaults/:id/entries/` | List entries (encrypted blobs) |
| `POST` | `/api/v1/vaults/:id/entries/` | Create entry |
| `PUT` | `/api/v1/entries/:id` | Update entry |
| `DELETE` | `/api/v1/entries/:id` | Delete entry |

### Audit

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/audit/logs` | Paginated audit logs (filter by action) |

---

## Security Headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

`wasm-unsafe-eval` is required for the Argon2id WASM module to execute in the browser.

---

## Rate Limiting

| Scope | Limit | Window |
|-------|-------|--------|
| Login | 5 attempts | 15 min per IP |
| Register | 3 attempts | 1 hour per IP |
| API (authenticated) | 100 requests | 1 min per user |
| Global | 1000 requests | 1 min per IP |

The rate limiter is Redis-based and **fails open** — if Redis is unavailable, requests pass through. This is a deliberate availability-over-security tradeoff for the rate limiter specifically; auth and sessions still require Redis.

---

## Design Decisions

**Why Argon2id over bcrypt?**
Argon2id uses 64MB of memory per hash, making it resistant to GPU/ASIC parallelization. Bcrypt uses 4KB — trivially parallelizable on modern hardware. Argon2id won the Password Hashing Competition (2015) and is recommended by OWASP.

**Why double-hash the auth_key?**
Client hashes password → `auth_key`. Server hashes `auth_key` → stored hash. Database leak exposes a hash-of-a-hash — two independent Argon2id layers to crack.

**Why one session per user?**
For a password manager, security over convenience. Each login invalidates the previous session. No zombie sessions on forgotten devices.

**Why non-extractable CryptoKey?**
The `enc_key` is imported into Web Crypto as non-extractable. Even if XSS achieves code execution, the key cannot be exported back to JavaScript bytes — it can only be used for encrypt/decrypt operations within the same tab session.

---

## Implementation Phases

| Phase | Focus | Status |
|-------|-------|--------|
| 1 — Infrastructure | Docker, Nginx, FastAPI, PostgreSQL, Redis, Alembic | ✅ |
| 2 — Auth Backend | Register, login, JWT, refresh rotation, rate limiting | ✅ |
| 3 — CRUD API | Vaults, entries, ownership validation, audit logging | ✅ |
| 4 — Client Crypto | Argon2id WASM, HKDF, AES-256-GCM, key pipeline | ✅ |
| 5 — Frontend UI | React pages, Zustand stores, Axios interceptors, E2E | ✅ |
| 6 — Hardening | Pentest suite, rate limiter fix, animations, polish | ✅ |

---

## Authors

- **[Kazxye](https://github.com/Kazxye)** — Architecture, backend, crypto pipeline, security audit
- **[giiuk](https://github.com/giiuk)** — Frontend implementation, UI components

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.