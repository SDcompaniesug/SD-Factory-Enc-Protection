# S.D Factory Enc — first-test source

This source contains a read-only APK inspector, local stdio MCP server, Fetch-compatible API handler and Postgres schema.

## Honest implementation status

**APK protection is not implemented.** There is no DEX rewriting engine, encrypted DEX loader, JNI bridge generator, native runtime, APK rebuild/signing pipeline, object-upload endpoint or cloud worker dispatcher. The protect API fails closed and never returns a fabricated protected APK.

The exact future loader package is `com.sdfactory.enc` (no `.loader` suffix). The protection milestone must support `armeabi-v7a` and `arm64-v8a`, preserve unselected Activities, and pass real install/launch tests before it is enabled.

Anti-debugging and anti-instrumentation are defensive friction only; they cannot guarantee that runtime code is impossible to dump from an attacker-controlled device.

## Components

- `worker/`: Androguard read-only APK inventory and manifest Activity parser.
- `plugin/`: local MCP server that invokes the worker in a constrained Docker container.
- `backend/`: API handler source and Postgres schema; not deployed.
- `docs/`: deployment and verification plan.

Run worker tests with `python -m unittest discover -s worker/tests -v`. APK inspection requires Androguard and a real APK. MCP startup requires Node dependencies and Docker. Neon requires deployment configuration outside this repository.
