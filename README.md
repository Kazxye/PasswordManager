
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
 
*\*Accepts expired JWT — validates signature only, not expiration*
 
### Vaults
 
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/vaults` | List user's vaults (encrypted names) | JWT |
| `POST` | `/api/v1/vaults` | Create vault | JWT |
| `PUT` | `/api/v1/vaults/:id` | Update vault name (re-encrypted) | JWT |
| `DELETE` | `/api/v1/vaults/:id` | Delete vault + all entries (CASCADE) | JWT |
 
### Entries
 
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/vaults/:id/entries` | List entries in vault (encrypted blobs) | JWT |
| `POST` | `/api/v1/vaults/:id/entries` | Create entry in vault | JWT |
| `PUT` | `/api/v1/entries/:id` | Update entry (re-encrypted) | JWT |
| `DELETE` | `/api/v1/entries/:id` | Delete entry | JWT |
 
### Audit Logs
 
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/audit/logs` | Paginated audit logs with optional action filter | JWT |
 
Query parameters: `?page=1&limit=50&action=login`
 
All CRUD operations are audit-logged with IP address, user-agent, and contextual metadata (vault_id, entry_id). Users can only access their own resources and logs — ownership is enforced at the service layer via direct and indirect (JOIN-based) validation.
 
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
 
- **users** — `id` (UUID), `email`, `auth_key_hash` (Argon2id), timestamps
- **vaults** — `id` (UUID), `user_id` (FK), `name_encrypted` (AES-256-GCM blob), `name_iv` (96-bit nonce), timestamps
- **entries** — `id` (UUID), `vault_id` (FK), `data_encrypted` (full JSON blob), `data_iv` (96-bit nonce), timestamps
- **audit_logs** — `id` (UUID), `user_id` (FK), `action`, `ip_address` (INET), `user_agent`, `metadata` (JSONB), `created_at`
 
The server never sees: vault names, site URLs, usernames, passwords, or notes. Only `audit_logs` contains plaintext — intentionally, for anomaly detection and incident response.
 
Cascade deletes ensure referential integrity: deleting a user removes all vaults; deleting a vault removes all entries.
 
---
 
## Ownership & Access Control
 
Every data access is scoped to the authenticated user:
 
- **Vaults:** `WHERE vault.id = :id AND vault.user_id = :current_user` — single-query ownership check
- **Entries:** `JOIN vault ON entry.vault_id = vault.id WHERE vault.user_id = :current_user` — indirect ownership via parent vault, validated in a single query to prevent race conditions
- **Audit logs:** `WHERE audit_log.user_id = :current_user` — users only see their own activity
 
Failed ownership checks return **404 Not Found** (not 403 Forbidden) to prevent resource enumeration by unauthorized users.
 
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
 
`wasm-unsafe-eval` is required in CSP for the Argon2id WASM module to execute in the browser.
 
---
 
## Rate Limiting
 
| Scope | Limit | Window |
|-------|-------|--------|
| Login | 5 attempts | 15 min per IP |
| Register | 3 attempts | 1 hour per IP |
| API (authenticated) | 100 requests | 1 min per user |
| Global | 1000 requests | 1 min per IP |
 
Rate limiter is Redis-based and **fails open** — if Redis is unavailable, requests are allowed through rather than blocking all traffic. This is a deliberate availability-over-security tradeoff for the rate limiter specifically (auth and sessions still require Redis).
 
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
| 1 — Setup & Infrastructure | Docker, Nginx, FastAPI skeleton, DB models, Alembic migrations | ✅ Complete |
| 2 — Auth Backend | Register, login, JWT, refresh, logout, rate limiting, audit logging | ✅ Complete |
| 3 — CRUD API | Vaults, entries, ownership validation, audit logging, paginated queries | ✅ Complete |
| 4 — Client-side Crypto | Argon2id WASM, AES-256-GCM, key derivation pipeline | ⬜ Planned |
| 5 — Frontend UI | React app, Zustand stores, Axios interceptors, full E2E integration | ⬜ Planned |
| 6 — Hardening | Security audit, auto-lock, CSP audit, penetration testing | ⬜ Planned |
 
---
 
## Key Design Decisions
 
**Why Argon2id over bcrypt/scrypt?**
Argon2id is memory-hard (64MB per hash), making it resistant to GPU and ASIC attacks. Bcrypt uses only 4KB of memory — trivially parallelizable on modern hardware. Argon2id won the Password Hashing Competition (2015) and is recommended by OWASP.
 
**Why double-hash the auth_key?**
The client hashes the password with Argon2id to derive `auth_key`. The server hashes `auth_key` again with Argon2id. If the database leaks, the attacker has a hash of a hash — two independent Argon2id layers to crack. Even with the database, they cannot authenticate without reversing the server-side hash first.
 
**Why one session per user?**
For a password manager, security takes priority over convenience. Each login invalidates the previous session by overwriting the Redis key. No zombie sessions on forgotten devices, no session accumulation.
 
**Why JWT + refresh cookie instead of session-only?**
JWTs are stateless for most requests (no Redis lookup on every API call). The refresh token in an HttpOnly cookie handles session continuity without exposing tokens to JavaScript. The JWT blacklist (for logout) uses TTL-based auto-cleanup — entries expire when the token would have expired anyway.
 
**Why 404 instead of 403 on ownership failures?**
Returning 403 Forbidden confirms the resource exists. An attacker could enumerate valid vault/entry IDs by checking for 403 vs 404. Uniform 404 responses reveal nothing about resource existence.
 
**Why fail-open rate limiting?**
A Redis outage shouldn't block all users from accessing their passwords. The rate limiter degrades gracefully — authentication and session management still require Redis, but a temporary rate limiter bypass is an acceptable tradeoff vs. total service unavailability.
 
---
 
## Disclaimer
 
This is a portfolio project demonstrating full-stack security engineering. While it implements production-grade cryptographic patterns, it has **not undergone a professional security audit** and should not be used as a primary password manager for sensitive accounts without independent review.
 
---
 
## License
 
MIT
 
---
 
*Built with obsessive attention to security — because your passwords deserve better than plaintext.*