# S.D Factory Enc — Neon backend

Production branch: `production` (`br-raspy-feather-bd1qvar8`) in `aws-us-east-2`.

## Deployed services

- Neon Managed Better Auth (email/password) is enabled.
- Email verification is required and uses one-time codes. Verification email is sent on sign-up and on unverified sign-in.
- Auth application name: `S.D Factory Enc`.
- Neon Auth issuer/JWKS values are injected into the Function environment; they are not shipped as secrets in the Android APK.
- Private Object Storage bucket: `apk-compiler-files`.
- Neon Function `factoryencapi` exists, but its latest deployment attempt failed because the bundle omitted runtime dependencies. A replacement zero-dependency Node.js implementation is in `backend/function/index.mjs`, but it has not been deployed successfully.
- API URL reserved for the Function: `https://br-raspy-feather-bd1qvar8-factoryencapi.compute.c-8.us-east-2.aws.neon.tech` (not currently confirmed healthy).
- `public.factory_enc_jobs` exists with output metadata columns and a worker index.

## Authentication flow

1. Android sends email/password to `/v1/auth/register` or `/v1/auth/login`.
2. Neon Managed Auth validates credentials and sends email verification codes.
3. `/v1/auth/verify-email` verifies the code. The user then signs in.
4. The API returns a short-lived JWT plus the Better Auth session cookie. Android stores both in an AES-GCM encrypted Android Keystore-backed record.
5. `/v1/auth/session` verifies JWT signature, issuer, EdDSA algorithm, expiry/age and subject using the branch JWKS.
6. `/v1/auth/refresh` exchanges the stored Better Auth session cookie for a fresh JWT.
7. Every protected job route independently verifies the JWT and filters records by its `sub`.

The app's login screen is not the security boundary. Direct API requests without a valid bearer token are rejected.

## API routes

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/verify-email`
- `POST /v1/auth/resend-verification`
- `POST /v1/auth/refresh`
- `POST /v1/auth/session` (protected)
- `POST /v1/jobs` (protected multipart APK upload)
- `GET /v1/jobs` (protected, caller-owned jobs only)
- `GET /v1/jobs/:id` (protected, caller-owned job only; completed jobs include a 10-minute presigned download URL)

## Processing worker

The isolated worker source is in `../worker`. It polls `uploaded` jobs, downloads source APKs from the private bucket, decodes/rebuilds with APKTool, relocates selected Activity class descriptors in Smali, aligns and signs the result, verifies the APK signature, and uploads the result. It stores one persistent generated signing key per user on its protected worker volume.

**The worker source is not deployed or running yet.** It requires a separate container host with Docker and the branch-scoped Neon database and S3 credentials. This environment has no Docker/container host access or outbound DNS, so it could not be built, launched or smoke-tested here. See `../worker/README.md`.

## Important limitations

- This implementation performs selected Activity class relocation/obfuscation. It does **not** include an encrypted DEX loader or native loader.
- The worker-generated signing identity differs from the APK's original developer certificate. The first output must be installed as a fresh install (uninstall the old app first); the worker keeps the same per-user key for later outputs. It cannot preserve an original Play/App Store signing identity without the owner's original signing key.
- APKTool rebuild compatibility varies by APK. Failed builds are marked `failed`, not `completed`.
- APK signature verification is performed; actual installation and runtime testing on a device are not performed by the worker.
- Production SMTP branding/custom sender is not configured; Neon shared SMTP currently sends verification messages. Neon recommends custom SMTP for production.
- External HTTP sign-up/login and Android compilation remain unverified from this environment because outbound DNS is unavailable and no Android SDK/Gradle installation is present. The latest Function deployment is **not healthy**; do not use the app against it until a successful deployment and live smoke test are completed.
