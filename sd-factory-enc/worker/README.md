# S.D Factory Enc isolated APK worker

This worker is intentionally separate from the public API Function. It requires Java, APKTool, Android Build Tools and access to the production branch's Postgres and private S3-compatible bucket.

## What it does

- Claims `uploaded` jobs transactionally with `FOR UPDATE SKIP LOCKED`.
- Downloads each APK from `apk-compiler-files` using the source key recorded by the API.
- Uses APKTool to decode the APK.
- Relocates the selected Activity class descriptor(s), including nested class references, across decoded Smali/XML. This is a real DEX-level class-name transformation, not a UI-only simulation.
- Rebuilds the APK, runs `zipalign`, signs with `apksigner`, and verifies the output signature.
- Uploads the result to the same private bucket and marks the job `completed`; failures are recorded as `failed`.
- Generates a persistent signing key per user in `/data/signing`. Keep the Docker volume backed up and private.

## Deploy

1. On a trusted container host in or near `aws-us-east-2`, create a private working directory.
2. Pull the production branch environment values using the Neon CLI (`neon env pull`) in a trusted environment. Copy only `DATABASE_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3` and `AWS_REGION` into `worker/.env`. Do not put credentials in source control or in the Android app.
3. Set `FACTORY_ENC_BUCKET=apk-compiler-files`.
4. Run `docker compose up -d --build` from this directory.
5. Check logs with `docker compose logs -f`. Submit a test APK you own and watch its job transition from `uploaded` to `processing` and then `completed` or `failed`.

The worker is not deployed by this project ZIP. It needs an actual Docker-capable host and branch credentials. No such host was connected in this session.

## Signing behavior

The worker creates one persistent signing identity per account and reuses it for that account's future jobs. This is necessary for later outputs from the same account to share a signing certificate. The first output does not match the original APK's developer signature, so Android will not install it as an in-place update over the original app. The original must be uninstalled first. Preserving the original signing identity requires the original owner's signing key, which is not extracted from the APK. Back up the `/data` Docker volume; losing it means losing the per-user signing identities.

## Boundaries

This worker implements selected Activity class relocation, not an encrypted DEX loader or anti-analysis/evasion mechanism. It verifies the APK signature but does not install or run the APK on a physical device. APKTool may reject some protected, split, OEM-specific or otherwise unsupported APKs; those jobs are marked failed with an error.
