# S.D Factory Enc — first test build

This is the source package for the first testable milestone of S.D Factory Enc.
It includes a real APK inspection worker, an MCP interface, a Neon Functions API
source package, a Postgres schema, and a Docker worker image definition.

## Important status

**This package does not yet claim to protect/repack APKs.** It implements APK
intake/inspection and Activity inventory. The protect operation deliberately
fails closed until the native DEX transformation + Android runtime loader engine
has passed device tests. It will never return a fake “protected” APK.

The final protection implementation must add and test:
- DEX extraction, transformation, and encrypted payload generation;
- the exact loader package `com.sdfactory.enc`;
- generated JNI-backed Activity bridges while preserving unselected Activities;
- ARM32 (`armeabi-v7a`) and ARM64 (`arm64-v8a`) native runtimes;
- integrity/signature checks and minimized plaintext exposure;
- APK rebuild, signing, install, and launch tests on real devices.

Anti-debugging/anti-instrumentation checks are defensive hardening only. They do
not make runtime code impossible to dump from a device controlled by an attacker.

## Layout
- `backend/` — Neon Function HTTP API source and SQL schema.
- `worker/` — Docker worker and APK inspection implementation.
- `plugin/` — MCP server source and portable plugin metadata template.
- `docs/` — deployment and test instructions.

## Current cloud resources discovered
- Neon project: `apk-compiler-storage`
- Region: `aws-us-east-2`
- Production branch: `br-raspy-feather-bd1qvar8`
- Existing private bucket: `apk-compiler-files`

No Neon Function existed on that branch when this package was prepared. The
connected Neon tools did not expose the initial function-creation operation, so
this source package is not represented as a live deployment.
