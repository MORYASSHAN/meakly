# ColdMailAI API And Workflow

This file is the backend reference for the microservice stack.

## Service Map

- `gateway` on `:5000`
- `auth-service` on `:5001`
- `user-service` on `:5002`
- `usage-service` on `:5003`
- `ai-service` on `:5004`
- `email-service` on `:5005`
- `billing-service` on `:5006`
- `notification-service` on `:5007`

## Request Rules

- Public requests go through the gateway.
- Protected routes require `Authorization: Bearer <accessToken>`.
- Internal service calls require `x-service-token`.
- Most write endpoints accept JSON only.

## Public Gateway Routes

- `GET /` - gateway status
- `GET /api/v1/system/services` - registered service list
- `GET /api/v1/system/health` - aggregated service health and latency
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/auth/verify-email`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `GET /api/v1/users/me/subscription`
- `GET /api/v1/users/me/usage`
- `POST /api/v1/users/bug-reports`
- `GET /api/v1/users/me/bug-reports`
- `GET /api/v1/usage/current`
- `POST /api/v1/usage/check`
- `POST /api/v1/usage/reserve`
- `POST /api/v1/usage/commit`
- `POST /api/v1/usage/release`
- `POST /api/v1/usage/reset`
- `POST /api/v1/ai/generate-email`
- `POST /api/v1/ai/rewrite-email`
- `POST /api/v1/ai/generate-followups`
- `POST /api/v1/emails/generate`
- `GET /api/v1/emails`
- `GET /api/v1/emails/:id`
- `DELETE /api/v1/emails/:id`
- `PATCH /api/v1/emails/:id/favorite`
- `GET /api/v1/billing/plans`
- `POST /api/v1/billing/checkout`
- `POST /api/v1/billing/portal`
- `GET /api/v1/billing/status`
- `POST /api/v1/billing/webhook`

## Internal Service Routes

These are called only by other services with the internal service token.

- `POST /internal/profiles/bootstrap`
- `GET /internal/profiles/by-user-id/:userId`
- `PATCH /internal/profiles/plan`
- `DELETE /internal/profiles/:userId`
- `POST /internal/usage/bootstrap`
- `GET /internal/usage/current/:userId`
- `PATCH /internal/usage/plan`
- `DELETE /internal/usage/:userId`
- `POST /internal/notifications/verify-email`
- `POST /internal/notifications/password-reset`
- `POST /internal/notifications/email`
- `GET /internal/notifications/logs`
- `PATCH /internal/account/plan`
- `GET /internal/auth/user/:userId`

## Core Workflow

### 1. Sign up

1. Client calls `POST /api/v1/auth/register`.
2. Auth service creates the auth user.
3. User service creates the user profile.
4. Usage service creates the monthly quota bucket.
5. Notification service sends a verification email.
6. Auth service returns access and refresh tokens.

### 2. Verify email

1. User opens the verification link.
2. Client calls `GET /api/v1/auth/verify-email`.
3. Auth service marks the token used.
4. User account status becomes active.

### 3. Login and profile load

1. Client calls `POST /api/v1/auth/login`.
2. Client can then call `GET /api/v1/auth/me`.
3. User service and usage service snapshots are attached to the response.

### 4. Generate cold email

1. Client calls `POST /api/v1/emails/generate`.
2. Email service reserves quota through usage service.
3. Email service calls AI service.
4. AI service calls Groq.
5. Email service stores the generated email.
6. Email service commits quota.

### 5. Billing upgrade

1. Client calls `POST /api/v1/billing/checkout`.
2. Stripe checkout creates a subscription session.
3. Stripe webhook hits `POST /api/v1/billing/webhook`.
4. Billing service syncs plan changes into auth, user, and usage services.

### 6. Bug reporting

1. Signed-in user calls `POST /api/v1/users/bug-reports`.
2. The report is stored with severity, page URL, steps, and metadata.
3. User can later list reports with `GET /api/v1/users/me/bug-reports`.

## Example Requests

### Register

```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Shaan\",\"email\":\"you@example.com\",\"password\":\"StrongPassword123\"}"
```

### Login

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"you@example.com\",\"password\":\"StrongPassword123\"}"
```

### Generate Email

```bash
curl -X POST http://localhost:5000/api/v1/emails/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d "{\"companyName\":\"Acme\",\"myOffer\":\"lead gen\",\"targetRole\":\"Founder\",\"painPoint\":\"low outbound replies\"}"
```

### Report a Bug

```bash
curl -X POST http://localhost:5000/api/v1/users/bug-reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d "{\"subject\":\"Dashboard crash\",\"description\":\"The dashboard crashes after login.\",\"stepsToReproduce\":\"1. Login 2. Open dashboard\",\"expectedResult\":\"Dashboard should load\",\"actualResult\":\"Blank page\",\"pageUrl\":\"http://localhost:5000/dashboard\",\"severity\":\"high\",\"appVersion\":\"1.0.0\",\"browser\":\"Chrome\"}"
```

## First Test Sequence

1. Start MongoDB.
2. Install dependencies.
3. Start all services.
4. Check `GET /api/v1/system/health`.
5. Register a user.
6. Verify email.
7. Login.
8. Generate one email.
9. Read email history.
10. Create one bug report.

