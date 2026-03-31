# 🔐 VaultKeeper

**Zero-knowledge password manager** — the server never sees your passwords.

All encryption happens exclusively in the browser. The backend stores only opaque, encrypted blobs. Even with full database access, an attacker gets nothing usable.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      BROWSER (Client)                   │
│                                                         │
│  master_password + email                                │
│         │                                               │
│         ▼                                               │
│  Argon2id (WASM, 64MB, 3 iterations)                   │
│         │                                               │
│         ├──► HKDF("auth") ──► auth_key ──► sent to API  │
│         │                                               │
│         └──► HKDF("enc")  ──► enc_key  ──► NEVER leaves │
│                                    │                    │
│                                    ▼                    │
│                          AES-256-GCM encrypt/decrypt    │
│                          (per-entry unique IV)          │
└────────────────────────────┬────────────────────────────┘
                             │ HTTPS only
                             ▼
┌─────────────────────────────────────────────────────────┐
│                     SERVER (API)                        │
│                                                         │
│  • Stores Argon2id(auth_key) — never the key itself     │
│  • Stores encrypted blobs — cannot decrypt them         │
│  • JWT (15min) + HttpOnly refresh cookie (7d rotation)  │
│  • Rate limiting, audit logs, request tracing           │
└─────────────────────────────────────────────────────────┘
```

The server operates as a **"dumb storage"** — it authenticates users and stores/retrieves encrypted data, but has zero ability to read it.

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Python 3.13 + FastAPI |
| Database | PostgreSQL 16 |
| Cache / Sessions | Redis 7 |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Auth hashing | argon2-cffi (server-side second hash) |
| JWT | python-jose |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Client-side crypto | Web Crypto API + argon2-browser (WASM) |
| State | Zustand (in-memory only) |
| HTTP | Axios |
| Styling | TailwindCSS |

### Infrastructure
| Component | Technology |
|---|---|
| Containers | Docker + Docker Compose |
| Reverse Proxy | Nginx (TLS + security headers) |
| TLS (dev) | OpenSSL self-signed |

---

## Security Model

| Threat | Mitigation |
|---|---|
| Database breach | Zero-knowledge — only encrypted blobs stored |
| Master password brute force | Argon2id (64MB memory-hard) — ~0.5s per attempt |
| JWT hijacking | 15min TTL + HTTPS + refresh rotation |
| XSS → token theft | Refresh token in HttpOnly/Secure/SameSite=Strict cookie |
| CSRF | SameSite=Strict cookies + JWT in Authorization header |
| Login brute force | Redis-based rate limiting + exponential backoff |
| Man-in-the-middle | Mandatory HTTPS (HSTS) |
| Replay attack | Unique IV per entry + JWT expiration claims |
| Session fixation | Refresh token rotation on every use |

### Key Design Decisions

- **Key separation via HKDF**: `auth_key` and `enc_key` are derived independently from the master key. Compromising the auth flow doesn't expose encryption keys.
- **Salt = SHA256(email)**: Deterministic salt eliminates the need to fetch salt from the server before login, preventing user enumeration timing attacks.
- **Double hashing**: The client sends `auth_key` (derived via Argon2id). The server hashes it **again** with Argon2id before storing. Defense in depth — even a memory dump of the server process doesn't expose usable credentials.
- **enc_key never persists**: Lives only in JavaScript memory (Zustand store). Auto-cleared on inactivity (5min), tab close, or logout.

---

## Running Locally

### Prerequisites

- Docker + Docker Compose
- Python 3.13+
- Node.js 20+
- OpenSSL

### Quick Start

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/vaultkeeper.git
cd vaultkeeper

# Configure environment
cp .env.example .env
# Edit .env with your values (especially JWT_SECRET_KEY)

# Start everything
docker compose up -d

# Run migrations
make migrate

# API available at https://localhost/api/v1
# Frontend at https://localhost:3000
```

### Development (without Docker)

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

---

## API Overview

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Create account (email + auth_key) |
| POST | `/api/v1/auth/login` | Authenticate → JWT + refresh cookie |
| POST | `/api/v1/auth/refresh` | Rotate tokens (cookie-based) |
| POST | `/api/v1/auth/logout` | Revoke session |

### Vaults (requires JWT)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/vaults` | List user's vaults (encrypted names) |
| POST | `/api/v1/vaults` | Create vault |
| PUT | `/api/v1/vaults/:id` | Rename vault |
| DELETE | `/api/v1/vaults/:id` | Delete vault + all entries (CASCADE) |

### Entries (requires JWT)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/vaults/:vault_id/entries` | List entries (encrypted blobs) |
| POST | `/api/v1/vaults/:vault_id/entries` | Create entry |
| PUT | `/api/v1/entries/:id` | Update entry |
| DELETE | `/api/v1/entries/:id` | Delete entry |

---

## Project Structure

```
PasswordManager/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + lifespan events
│   │   ├── config.py            # Environment settings (pydantic-settings)
│   │   ├── database.py          # Async SQLAlchemy engine
│   │   ├── models/              # SQLAlchemy models (User, Vault, Entry, AuditLog)
│   │   ├── schemas/             # Pydantic request/response validation
│   │   ├── routers/             # API route handlers
│   │   ├── services/            # Business logic layer
│   │   ├── middleware/          # Rate limiting, request ID
│   │   ├── dependencies/        # DI (get_db, get_current_user)
│   │   └── utils/               # Redis client, security helpers
│   ├── alembic/                 # Database migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── crypto/              # Argon2id WASM + AES-256-GCM + HKDF
│       ├── api/                 # Axios client + interceptors
│       ├── stores/              # Zustand (JWT + vault state, memory-only)
│       ├── hooks/               # useAutoLock, useCrypto
│       ├── pages/               # Login, Register, VaultList, EntryDetail
│       └── components/          # PasswordGenerator, StrengthMeter, ProtectedRoute
├── nginx/                       # Reverse proxy + TLS + security headers
├── docker-compose.yml
└── Makefile
```

---

## License

MIT
