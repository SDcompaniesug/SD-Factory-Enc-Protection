# Deployment and verification guide

## Neon

Known resources: project `apk-compiler-storage`, region `aws-us-east-2`, production branch `br-raspy-feather-bd1qvar8`, private bucket `apk-compiler-files`. Apply `backend/schema.sql` to the intended branch.

`backend/neon-function.ts` is Fetch-compatible API source, not a deployed Neon Function. It requires `DATABASE_URL` and `SDE_API_KEY` plus a compatible runtime/deployment adapter and the `pg` dependency. It records an already-uploaded trusted storage key; signed upload, object-store access, worker dispatch and cloud MCP are not implemented.

## Local inspector

```sh
cd worker
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
python inspect_apk.py /absolute/path/to/sample.apk --json
```

Build the isolated worker:

```sh
docker build -t sd-factory-enc-worker:latest worker/
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --memory 1g --cpus 2 --mount type=bind,src="/absolute/path/to/sample.apk",dst=/input.apk,readonly sd-factory-enc-worker:latest /input.apk --json
```

## Local MCP

```sh
cd plugin
npm install
node server.mjs
```

Configure from `plugin/mcp.json.template`. Docker must be available to the same user running the MCP server.

## Protection engine release gate

Do not enable protection until:
1. DEX transformation and payload encryption produce deterministic artifacts.
2. Loader package is exactly `com.sdfactory.enc`.
3. Selected Activities use generated JNI bridges; unselected Activities retain their original implementations.
4. ARM32 (`armeabi-v7a`) and ARM64 (`arm64-v8a`) native runtimes load on matching devices.
5. Rebuilt APK passes `apksigner verify --verbose --print-certs` and installs.
6. Instrumented tests verify selected and unselected Activity lifecycles.
7. Tampering tests fail closed. Never claim perfect anti-dump protection.

## Test boundaries

Unit tests cover manifest Activity name resolution, explicit exported values, legacy defaults, Android 12+ defaults and Activity aliases. APK inspection requires Androguard and a real APK. Docker build requires Docker and package access. MCP startup requires npm dependencies. Neon connectivity requires external deployment configuration. APK protection/rebuild/sign/install/launch are not implemented in this milestone.
