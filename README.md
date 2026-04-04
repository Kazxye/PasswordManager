# 🔐 VaultKeeper

**A zero-knowledge password manager where the server never sees your passwords.**

VaultKeeper is a full-stack, security-first password manager built from scratch as a portfolio project. It implements real-world cryptographic patterns used by industry leaders like Bitwarden and 1Password — master password derivation, client-side encryption, and a server that stores only opaque, encrypted blobs.

> **Zero-knowledge means:** even if the database is fully compromised, an attacker gets nothing usable. No plaintext passwords, no vault names, no decryptable data. The encryption keys never leave the browser.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                          │
│                                                                     │
│   master_password + email                                           │
│          │                                                          │
│          ▼                                                          │
│   Argon2id (WASM, 64MB, 3 iterations)                               │
│          │                                                          │
│          ▼                                                          │
│     master_key (512 bits)                                           │
│          │                                                          │
│          ├──► HKDF("auth")  ──► auth_key ──► sent to server         │
│          │                                                          │
│          └──► HKDF("enc")   ──► enc_key  ──► NEVER leaves client    │
│                                    │                                │
│                                    ▼                                │
│                            AES-256-GCM                              │
│                     encrypt/decrypt vault data                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                         HTTPS only
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                         SERVER (FastAPI)                            │
│                                                                     │
│   Receives auth_key ──► Argon2id hash (defense in depth)            │
│   Stores encrypted blobs ──► cannot decrypt anything                │
│   Issues JWT (15min) + refresh token (HttpOnly cookie, 7 days)      │
│   Rate limiting, audit logging, token rotation                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Security Model

### Cryptographic Pipeline

| Stage | Algorithm | Purpose |
|-------|-----------|---------|
| Key derivation (client) | Argon2id via WASM | Memory-hard KDF — 64MB, 3 iterations, resistant to GPU/ASIC attacks |
| Salt derivation | SHA256(email) | Deterministic, no pre-auth fetch required |
| Key separation | HKDF-SHA256 | Derives independent `auth_key` and `enc_key` from `master_key` |
| Data encryption | AES-256-GCM | Authenticated encryption — each entry has a unique 96-bit IV |
| Server auth hash | Argon2id | Second hash of `auth_key` — if DB leaks, attacker still can't authenticate |

### Threat Mitigation

| Threat | Defense | Implementation |
|--------|---------|----------------|
| Database compromise | Zero-knowledge architecture | Server stores only encrypted blobs + hashed auth keys |
| Brute force (password) | Argon2id 64MB per attempt | ~500ms per guess makes large-scale attacks infeasible |
| Brute force (login) | Redis-based rate limiting | 5 attempts / 15 min per IP with exponential backoff |
| JWT hijacking | Short-lived tokens | 15 min TTL + HTTPS-only + refresh rotation |
| XSS → token theft | HttpOnly cookies | Refresh token inaccessible to JavaScript |
| CSRF | SameSite=Strict + JWT in header | Cookie not sent cross-origin; API requires Authorization header |
| Session fixation | Token rotation | New refresh token issued on every refresh |
| Man-in-the-middle | HSTS + TLS | HTTP → HTTPS redirect, strict transport security |
| Replay attacks | Unique IVs + JWT expiration | Every encrypted entry has a random IV; tokens expire |

---

## Tech Stack

### Backend

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | FastAPI (async) | High performance, native async/await, automatic OpenAPI docs |
| Database | PostgreSQL 16 | ACID compliance, UUID support, JSONB for audit metadata |
| Cache / Sessions | Redis 7 | Token storage, rate limiting, JWT blacklist — all with TTL |
| ORM | SQLAlchemy 2.0 (async) | Type-safe queries, async session management |
| Migrations | Alembic | Version-controlled schema changes |
| Auth hashing | argon2-cffi | Reference Argon2id implementation for Python |
| JWT | python-jose | HMAC-SHA256 signed tokens |

### Frontend

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | React 18 + TypeScript | Type safety, component architecture |
| Build | Vite | Fast HMR, native ESM |
| Crypto | Web Crypto API + argon2-browser (WASM) | Browser-native AES-256-GCM, Argon2id without server dependency |
| State | Zustand | Lightweight, no boilerplate — keys live only in memory |
| HTTP | Axios | Interceptors for automatic token refresh |
| Styling | TailwindCSS | Utility-first, rapid prototyping |

### Infrastructure

| Component | Technology | Why |
|-----------|-----------|-----|
| Orchestration | Docker Compose | Reproducible multi-service environment |
| Reverse proxy | Nginx | TLS termination, security headers, rate limiting |
| TLS (dev) | OpenSSL self-signed | HTTPS in development — required for Secure cookies |
| TLS (prod) | Let's Encrypt | Free, automated certificate management |

---

## Project Structure

```
VaultKeeper/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan events
│   │   ├── config.py            # Settings via pydantic-settings
│   │   ├── database.py          # Async SQLAlchemy engine + session
│   │   ├── models/              # SQLAlchemy models (User, Vault, Entry, AuditLog)
│   │   ├── schemas/             # Pydantic request/response validation
│   │   ├── routers/             # HTTP endpoint handlers
│   │   ├── services/            # Business logic layer
│   │   ├── middleware/          # Rate limiting, request ID tracking
│   │   ├── dependencies/       # FastAPI DI (auth, database)
│   │   └── utils/              # Security helpers, Redis client
│   ├── alembic/                # Database migrations
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── crypto/             # Argon2id WASM, AES-256-GCM, key pipeline
│       ├── api/                # Axios client, auth/vault API calls
│       ├── stores/             # Zustand (JWT + enc_key in memory only)
│       ├── hooks/              # Auto-lock, crypto interface
│       ├── pages/              # Login, Register, VaultList, EntryDetail
│       └── components/         # PasswordGenerator, StrengthMeter, ProtectedRoute
├── nginx/
│   ├── nginx.conf              # TLS, security headers, proxy
│   └── ssl/                    # Certificates
├── docker-compose.yml
└── ARCHITECTURE.md             # Full technical specification
```

---

## Quick Start

### Prerequisites

- Docker + Docker Compose
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/vaultkeeper.git
cd vaultkeeper

# Create environment file
cp .env.example .env
# Edit .env — at minimum, change JWT_SECRET_KEY and POSTGRES_PASSWORD

# Generate a secure JWT secret
openssl rand -hex 64

# Start all services
docker compose up --build -d

# Run database migrations
docker compose exec api alembic upgrade head

# Verify — should return {"status": "healthy", ...}
curl -k https://localhost/health
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/auth/register` | Create account (email + auth_key) | — |
| `POST` | `/api/v1/auth/login` | Authenticate → JWT + refresh cookie | — |
| `POST` | `/api/v1/auth/refresh` | Rotate tokens (cookie-based) | JWT* |
| `POST` | `/api/v1/auth/logout` | Revoke all tokens | JWT |

*\*Accepts expired JWT — only validates signature*

### Vaults

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/vaults` | List user's vaults (encrypted names) | JWT |
| `POST` | `/api/v1/vaults` | Create vault | JWT |
| `PUT` | `/api/v1/vaults/:id` | Update vault name | JWT |
| `DELETE` | `/api/v1/vaults/:id` | Delete vault + all entries (CASCADE) | JWT |

### Entries

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/vaults/:id/entries` | List entries (encrypted blobs) | JWT |
| `POST` | `/api/v1/vaults/:id/entries` | Create entry | JWT |
| `PUT` | `/api/v1/entries/:id` | Update entry | JWT |
| `DELETE` | `/api/v1/entries/:id` | Delete entry | JWT |

---

## Auth Flow

```
 ┌──────────┐                                    ┌──────────┐
 │  Client  │                                    │  Server  │
 └────┬─────┘                                    └────┬─────┘
      │                                               │
      │  1. User enters email + master_password        │
      │  2. salt = SHA256(email)                       │
      │  3. master_key = Argon2id(password, salt)      │
      │  4. auth_key = HKDF(master_key, "auth")        │
      │  5. enc_key  = HKDF(master_key, "enc")         │
      │                                               │
      │──── POST /auth/login {email, auth_key} ──────►│
      │                                               │  6. Verify Argon2id(auth_key)
      │                                               │  7. Generate JWT + refresh_token
      │                                               │  8. Store refresh in Redis (7d TTL)
      │◄──── 200 {access_token} + Set-Cookie ─────────│
      │                                               │
      │  9. Store JWT in memory (Zustand)              │
      │  10. enc_key stays in memory                   │
      │  11. Fetch + decrypt vaults locally            │
      │                                               │
```

---

## Database Schema

Four tables, designed for zero-knowledge:

- **users** — `id`, `email`, `auth_key_hash` (Argon2id), timestamps
- **vaults** — `id`, `user_id`, `name_encrypted` (AES-256-GCM blob), `name_iv`, timestamps
- **entries** — `id`, `vault_id`, `data_encrypted` (full JSON blob), `data_iv`, timestamps
- **audit_logs** — `id`, `user_id`, `action`, `ip_address`, `user_agent`, `metadata` (JSONB), `created_at`

The server never sees: vault names, site URLs, usernames, passwords, or notes. Only `audit_logs` contains plaintext — intentionally, for anomaly detection.

---

## Security Headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

`wasm-unsafe-eval` is required in CSP for the Argon2id WASM module to execute.

---

## Development Tools

| Tool | Purpose |
|------|---------|
| Ruff | Python linter + formatter |
| Bruno / Insomnia | API testing |
| DBeaver | PostgreSQL GUI |
| lazydocker | Container monitoring TUI |
| ESLint + Prettier | Frontend linting + formatting |

---

## Implementation Phases

| Phase | Focus | Status |
|-------|-------|--------|
| 1 — Setup & Infrastructure | Docker, Nginx, FastAPI skeleton, DB models, migrations | ✅ Complete |
| 2 — Auth Backend | Register, login, JWT, refresh, rate limiting, audit | 🔧 In Progress |
| 3 — CRUD API | Vaults, entries, ownership validation, audit logging | ⬜ Planned |
| 4 — Client-side Crypto | Argon2id WASM, AES-256-GCM, key derivation pipeline | ⬜ Planned |
| 5 — Frontend UI | React app, Zustand stores, Axios interceptors, full integration | ⬜ Planned |
| 6 — Hardening | Security audit, auto-lock, CSP audit, penetration testing | ⬜ Planned |

---

## Key Design Decisions

**Why Argon2id over bcrypt/scrypt?** Argon2id is memory-hard (64MB per hash), making it resistant to GPU and ASIC attacks. Bcrypt uses only 4KB of memory — trivially parallelizable on modern hardware.

**Why double-hash the auth_key?** The client hashes the password with Argon2id. The server hashes the resulting `auth_key` again. If the database leaks, the attacker has a hash of a hash — two independent layers to crack before they can authenticate.

**Why one session per user?** For a password manager, security takes priority over convenience. Each login invalidates the previous session. No zombie sessions on forgotten devices.

**Why JWT + refresh cookie instead of session-only?** JWTs are stateless for most requests (no Redis lookup). The refresh token in an HttpOnly cookie handles session continuity without exposing tokens to JavaScript.

---

## Disclaimer

This is a portfolio / educational project demonstrating full-stack security engineering. While it implements real cryptographic patterns, it has **not undergone a professional security audit** and should not be used as a primary password manager for sensitive accounts without independent review.

---

## License

MIT

---

*Built with obsessive attention to security by someone who believes your passwords deserve better than plaintext.*