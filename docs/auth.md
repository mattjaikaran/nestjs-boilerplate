# Auth System

This boilerplate ships a comprehensive, production-ready auth system. All endpoints live under `/api/v1/auth`.

## Supported Methods

| Method | Endpoint | Description |
|--------|----------|-------------|
| Email/Password | `POST /register`, `POST /login` | Classic credential auth |
| Refresh tokens | `POST /refresh` | Rotate access/refresh token pair |
| Logout | `POST /logout` | Revoke current or all refresh tokens |
| Forgot/Reset password | `POST /forgot-password`, `POST /reset-password` | OTP-based password reset |
| Email verification | `GET /verify-email/:token` | Verify email on register |
| Magic link | `POST /magic-link`, `GET /magic-link/:token` | Passwordless login via email |
| Google OAuth | `GET /google`, `GET /google/callback` | OAuth 2.0 via Google |
| GitHub OAuth | `GET /github`, `GET /github/callback` | OAuth 2.0 via GitHub |
| WebAuthn | `POST /webauthn/register/options+verify`, `POST /webauthn/authenticate/options+verify` | Touch ID / Face ID / hardware key |

## Token Strategy

- **Access token**: JWT, 15 min TTL, signed with `JWT_SECRET`
- **Refresh token**: JWT, 7 day TTL, signed with `JWT_REFRESH_SECRET`, stored in DB
- **Rotation**: refresh always issues a new pair and revokes the old token
- **Revocation**: logout endpoint marks tokens as `isRevoked = true`
- On password reset, **all** refresh tokens are revoked

## WebAuthn (Touch ID / Face ID)

WebAuthn uses the [SimpleWebAuthn](https://simplewebauthn.dev/) library.

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
WEBAUTHN_ORIGIN=https://myapp.com # full origin
```

## OTP / Email verification

OTPs are stored in the `otps` table with a 30-minute expiry. The `OtpService.createAndSendOtp` method currently logs the code/token to the console. Wire it to your email provider (Resend, SendGrid, Nodemailer) by replacing the `console.log` with an actual send call.

## OAuth Setup

### Google
1. [Google Cloud Console](https://console.cloud.google.com) → OAuth 2.0 credentials
2. Authorized redirect URIs: `http://localhost:3000/api/v1/auth/google/callback`
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`

### GitHub
1. [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Authorization callback URL: `http://localhost:3000/api/v1/auth/github/callback`
3. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`

## Guards

- `JwtAuthGuard` (global) — protects all routes by default
- `@Public()` — opt-out decorator for public endpoints
- `@Roles(UserRole.ADMIN)` — role-based access control
- `RolesGuard` (global) — enforces `@Roles()` decorators
