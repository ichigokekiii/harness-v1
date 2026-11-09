# Tabi (Harness v1)

Faculty workspace demo. Chat, library, Space canvas, forms, and admin flows.

## Run locally

```bash
pnpm install
cp .env.example .env.local
# Set AUTH_SECRET to any long random string in .env.local
pnpm dev
```

Open http://127.0.0.1:3100/login. Demo password for every role is `123456`.

| Username | Role | Lands on |
|----------|------|----------|
| `faculty` | Teacher | Chat |
| `admin` | Institution admin | Admin queue |
| `superadmin` | Super admin | Super overview |

## Deploy on Vercel

1. Import https://github.com/ichigokekiii/harness-v1 in [Vercel](https://vercel.com/new).
2. Framework preset should detect **Next.js**.
3. Add environment variable **AUTH_SECRET** (required). Generate one with `openssl rand -base64 32`.
4. Leave **NEXT_PUBLIC_HARNESS_API** unset or set to `mock` for the demo.
5. Deploy.

Data resets on cold starts. Each visitor gets the sample seed database. That is expected on Vercel until a hosted database is wired.

Optional Google sign-in later: set **AUTH_GOOGLE_ID**, **AUTH_GOOGLE_SECRET**, and **AUTH_GOOGLE_ROLES**, and add the Vercel callback URL in Google Cloud Console (`https://<your-app>.vercel.app/api/auth/google/callback`).
