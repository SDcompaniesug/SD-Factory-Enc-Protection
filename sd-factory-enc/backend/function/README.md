# Factory Enc Neon Function

The Neon Function `factoryencapi` exists, but its latest deployment attempt failed because the uploaded bundle omitted runtime dependencies. The current source has been rewritten to use only Node.js built-ins (including a minimal PostgreSQL TLS/SCRAM client and SigV4 S3 requests) so it can be deployed without third-party packages. That replacement source has passed `node --check`, but has **not** yet been deployed or smoke-tested.

Uses Neon Managed Better Auth for email/password sign-up, sign-in and OTP verification. Protected routes verify asymmetric JWT signatures against the injected branch JWKS, validate issuer/subject/expiry/age, and enforce user ownership in SQL. Supported signature algorithms are EdDSA, RS256 and ES256, each matched to its expected JWK type.

APK uploads are private and stored in `apk-compiler-files`. Uploads create `uploaded` jobs. The separate container worker in `../../worker` is required to transform, rebuild and sign APKs; until that worker is deployed, uploaded jobs remain `uploaded`.
