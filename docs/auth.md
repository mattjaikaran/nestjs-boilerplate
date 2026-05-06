# Auth System

All endpoints live under `/api/v1/auth`. Every route is public by default in this module; other routes are JWT-protected globally via `JwtAuthGuard`.

## Supported Methods

| Method | Endpoints | Description |
|--------|-----------|-------------|
| Email/Password | `POST /register`, `POST /login` | Classic credential auth with argon2 hashing |
| Refresh tokens | `POST /refresh` | Rotate access/refresh token pair |
| Logout | `POST /logout` | Revoke current or all refresh tokens |
| Forgot/Reset password | `POST /forgot-password`, `POST /reset-password` | OTP-based flow |
| Email verification | `GET /verify-email/:token` | Verify email after registration |
| Magic link | `POST /magic-link`, `GET /magic-link/:token` | Passwordless login via email |
| Google OAuth | `GET /google`, `GET /google/callback` | OAuth 2.0 |
| GitHub OAuth | `GET /github`, `GET /github/callback` | OAuth 2.0 |
| TOTP (2FA) | `POST /totp/setup`, `/totp/enable`, `/totp/verify`, `/totp/disable` | Authenticator app 2FA |
| WebAuthn | `POST /webauthn/register/options+verify`, `POST /webauthn/authenticate/options+verify` | Passkeys (Touch ID, Face ID, hardware keys) |
| API keys | Users `/me/api-keys` | Programmatic access without JWT |

---

## Token Strategy

- **Access token**: JWT, 15 min TTL, signed with `JWT_SECRET`
- **Refresh token**: JWT, 7 day TTL, signed with `JWT_REFRESH_SECRET`, stored in the `refresh_tokens` table
- **Rotation**: every `/refresh` call issues a new pair and revokes the old token
- **Revocation**: `/logout` marks the refresh token as `isRevoked = true`
- **Password reset**: revokes _all_ refresh tokens for the user

---

## TOTP (Two-Factor Authentication)

TOTP uses `otplib` compatible with Google Authenticator, Authy, 1Password, etc.

### Setup flow (authenticated user)
1. `POST /auth/totp/setup` — returns `{ secret, qrCode (base64 data URL) }`
2. User scans QR code with their authenticator app
3. `POST /auth/totp/enable` with `{ code }` — verifies the first code and enables TOTP

### Login flow (user has TOTP enabled)
1. `POST /auth/login` — if TOTP is enabled, returns `{ requiresTOTP: true, userId }` instead of tokens
2. `POST /auth/totp/verify` with `{ userId, code }` — returns full token pair

### Disable TOTP
- `POST /auth/totp/disable` with `{ code }` — requires a valid current code

---

## WebAuthn (Passkeys)

Uses [SimpleWebAuthn](https://simplewebauthn.dev/) server library.

### Registration flow (authenticated user adds a device)
1. `POST /auth/webauthn/register/options` → returns `PublicKeyCredentialCreationOptions`
2. Browser calls `navigator.credentials.create(options)`
3. `POST /auth/webauthn/register/verify` with the browser response

### Authentication flow (passwordless login)
1. `POST /auth/webauthn/authenticate/options` with `{ email }` → returns `PublicKeyCredentialRequestOptions`
2. Browser calls `navigator.credentials.get(options)`
3. `POST /auth/webauthn/authenticate/verify` with `{ email, response }` → returns tokens

### Config
```env
WEBAUTHN_RP_NAME=My App
WEBAUTHN_RP_ID=myapp.com          # domain without protocol
WEBAUTHN_ORIGIN=https://myapp.com # full origin with protocol
```

---

## OTP Flows

OTPs are 6-digit codes stored in the `otps` table with a 30-minute expiry. Two types:

| Type | Trigger | Used by |
|------|---------|---------|
| `email_verification` | On register | `GET /verify-email/:token` |
| `password_reset` | On `/forgot-password` | `POST /reset-password` |

The `OtpService.createAndSendOtp` method queues an email via BullMQ → `EmailProcessor` → Resend. Configure `RESEND_API_KEY` and `EMAIL_FROM`.

---

## Account Lockout

Redis-backed brute-force protection via `LockoutService`.

- **Threshold**: 5 failed login attempts
- **Lockout duration**: 15 minutes
- **Storage**: Redis key `lockout:<email>` with TTL
- **Behavior**: `checkLocked` throws `TooManyRequestsException` before any DB lookup; `recordFailure` increments the counter

Configure via env:
```env
LOCKOUT_MAX_ATTEMPTS=5
LOCKOUT_WINDOW_SECONDS=900
```

---

## API Keys

API keys allow programmatic access without OAuth flows. Keys are stored as argon2 hashes.

### Endpoints
```
POST   /api/v1/users/me/api-keys          # Create — returns key once (store it)
GET    /api/v1/users/me/api-keys          # List own keys (name, created, last used)
DELETE /api/v1/users/me/api-keys/:id      # Revoke key
```

### Usage
Pass the key in the `x-api-key` header:
```http
GET /api/v1/todos
x-api-key: bplt_...
```

The `ApiKeyGuard` runs after `JwtAuthGuard`. If a JWT is valid, the API key guard is skipped.

---

## OAuth Setup

### Google
1. [Google Cloud Console](https://console.cloud.google.com) → Credentials → OAuth 2.0 Client IDs
2. Authorized redirect URIs: `http://localhost:3000/api/v1/auth/google/callback`
3. Set env vars:
```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
```

### GitHub
1. [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Authorization callback URL: `http://localhost:3000/api/v1/auth/github/callback`
3. Set env vars:
```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=http://localhost:3000/api/v1/auth/github/callback
```

---

## Guards & Decorators

| Guard / Decorator | Purpose |
|-------------------|---------|
| `JwtAuthGuard` (global) | Protects all routes by default |
| `@Public()` | Opt-out: marks a route as unauthenticated |
| `@Roles(UserRole.ADMIN)` | Restrict route to one or more roles |
| `RolesGuard` (global) | Enforces `@Roles()` declarations |
| `@Permissions('todos:delete')` | Fine-grained permission check |
| `PermissionsGuard` (global) | Enforces `@Permissions()` declarations |
| `@CurrentUser()` | Parameter decorator — injects the JWT payload |
| `ApiKeyGuard` (global) | Validates `x-api-key` header when no JWT |
