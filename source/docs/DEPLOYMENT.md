# Deployment and test plan

## 1. Neon

The existing Neon project is `apk-compiler-storage`, in `aws-us-east-2`.
Its production branch already has the private `apk-compiler-files` bucket.
Apply `backend/schema.sql` to the production branch before deploying the API.

The Neon Functions control-plane API source is `backend/neon-function.ts`.
A first function must be created through Neon CLI / `neon.ts` or a supported
function-create operation, then deployed with the Neon Function deployment API.
The connected tools exposed list/get/update/delete/deploy but not the initial
create operation, so no function was created by this package build.

## 2. Worker

Build the inspector image:

```sh
cd worker
docker build -t sd-factory-enc-worker .
```

Run an inspection:

```sh
docker run --rm -v "$PWD/sample.apk:/input.apk:ro" sd-factory-enc-worker /input.apk
```

Run workers in isolated compute with no host Docker socket, no privileged mode,
read-only input mounts, per-job temp directories, strict CPU/memory/time limits,
network disabled during APK inspection, and deletion of temp files after each job.

## 3. Protection engine gate

Do not enable `POST /v1/jobs/{id}/protect` until all checks pass:
1. DEX transformation and payload encryption produce deterministic artifacts.
2. Generated loader code uses exactly `com.sdfactory.enc`.
3. Selected Activities route through generated JNI bridges; unselected ones retain original implementations.
4. `armeabi-v7a` and `arm64-v8a` `.so` files load on matching devices.
5. Rebuilt APK passes `apksigner verify --verbose --print-certs` and installs.
6. Instrumented tests confirm selected Activity lifecycle and unselected Activity behavior.
7. Tampering tests fail closed; no test claims perfect anti-dump protection.

## 4. Test checklist

- Valid APK: SHA-256, package, SDK levels, Activity inventory and DEX/native-library inventory returned.
- Invalid ZIP/APK: rejected with a nonzero exit and structured error.
- Oversized APK: rejected at 512 MiB.
- Activity selection: only requested names persisted; no wildcard expansion without explicit all-eligible selection.
- Protect endpoint while engine absent: HTTP 503, explicit `PROTECTION_ENGINE_NOT_DEPLOYED`, no output APK.
