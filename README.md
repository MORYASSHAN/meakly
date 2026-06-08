# ColdMailAI Backend

Backend-first, microservice-ready scaffold for a cold email SaaS.

## What is included

- API gateway with request IDs, proxying, and system health aggregation
- Auth service with signup, login, refresh, logout, email verification, password reset
- User service for profile and subscription snapshots
- Usage service with monthly quota tracking and reserve/commit/release flows
- AI service for cold email generation, rewriting, and follow-up generation
- Email service for generate, save, list, favorite, and delete
- Billing service for Stripe checkout, portal, webhook processing, and plan sync
- Notification service for verification and password reset emails
- User bug reporting endpoints for customer feedback and triage
- Metrics and latency instrumentation on inbound and outbound HTTP calls

## Service map

- `gateway` on `:5000`
- `auth-service` on `:5001`
- `user-service` on `:5002`
- `usage-service` on `:5003`
- `ai-service` on `:5004`
- `email-service` on `:5005`
- `billing-service` on `:5006`
- `notification-service` on `:5007`

## Runtime flow

1. User signs up through `POST /api/v1/auth/register`.
2. Auth service creates the auth user, bootstraps profile and usage records, and sends a verification email.
3. User logs in with `POST /api/v1/auth/login`.
4. User requests `POST /api/v1/emails/generate`.
5. Email service reserves quota, forwards the prompt to AI service, saves the email, then commits quota.
6. Billing service syncs subscription changes back into auth, user, and usage services through webhook events.

## API keys and links you need

- MongoDB Atlas connection string: [MongoDB Atlas](https://www.mongodb.com/atlas)
- Groq API key: [Groq API keys](https://console.groq.com/keys)
- Stripe secret key and publishable key: [Stripe API keys](https://dashboard.stripe.com/apikeys)
- Stripe product and price IDs: [Stripe Products](https://dashboard.stripe.com/products)
- Stripe webhook management: [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
- Gmail SMTP credentials: [Create a Google App Password](https://support.google.com/accounts/answer/185833)

## Local setup

1. Copy `.env.example` to `.env`.
2. Fill in the required values.
3. Start MongoDB:

```bash
docker compose up -d mongo
```

4. Install dependencies at the repo root:

```bash
npm install
```

5. Start everything:

```bash
npm run dev
```

If you want to run one service at a time, use:

```bash
npm run dev:gateway
npm run dev:auth
npm run dev:users
npm run dev:usage
npm run dev:ai
npm run dev:emails
npm run dev:billing
npm run dev:notifications
```

## API reference

See [API_WORKFLOW.md](C:/Users/Shaan/OneDrive/Desktop/meakly/API_WORKFLOW.md) for the full endpoint list, workflow, and first-test sequence.

## Important env vars

- `MONGO_URI`
- `AUTH_DB_NAME`
- `USER_DB_NAME`
- `USAGE_DB_NAME`
- `AI_DB_NAME`
- `EMAIL_DB_NAME`
- `BILLING_DB_NAME`
- `NOTIFICATION_DB_NAME`
- `SERVICE_INTERNAL_SECRET`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `GROQ_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_POWER_PRICE_ID`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`

## Observability

- Every request gets an `x-request-id`
- Every service exposes `/health` and `/metrics`
- Gateway exposes `/api/v1/system/health` to check all downstream services and their latency
- Downstream calls are timed and logged

## Scalability notes

- Services are already split by responsibility, so they can be deployed independently.
- Internal service routes are protected with a shared service token.
- Plan changes sync through the billing service into auth, user, and usage stores.
- The next big scale-up steps would be Redis or NATS for async jobs, OpenTelemetry tracing, and background workers for email delivery and webhook retries.
