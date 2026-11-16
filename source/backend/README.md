# S.D Factory Enc API

This Next.js API is deployed independently on Vercel from this directory. It must use only the `factoryenc` Neon database through `FACTORYENC_DATABASE_URL` and the dedicated `factoryenc_app` role.

## Required Vercel environment variables

- `FACTORYENC_DATABASE_URL`: pooled or direct connection string for database `factoryenc`, role `factoryenc_app`; never expose it to browser code.
- `BETTER_AUTH_SECRET`: random high-entropy secret (at least 32 bytes).
- `BETTER_AUTH_URL`: production API origin.

## Endpoints

- `GET /api/health` — public service health.
- `/api/auth/*` — Better Auth email/password and bearer-token authentication.
- `GET /api/v1/jobs` — list only the signed-in user's jobs.
- `POST /api/v1/jobs` — create a job for the signed-in user.
- `GET /api/v1/jobs/:id` — retrieve only the signed-in user's job.
- `POST /api/v1/jobs/:id/selection` — save Activity selection for an owned job.
- `POST /api/v1/jobs/:id/protect` — intentionally returns 503 until the protection engine is validated.

Android clients must store the bearer session token securely and send it in the Authorization header. Do not ship database credentials or a shared API key in the APK.

## Safety status

The API does not claim to protect APKs. The DEX transformation, encrypted runtime loader, native key handling, APK signing, and physical-device validation remain separate milestones.
