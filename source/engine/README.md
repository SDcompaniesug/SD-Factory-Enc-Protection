# S.D Factory Enc — encrypted DEX container core

This milestone implements the binary payload layer for the agreed shell design.
It is an independently written format and does not copy Arkjiagu source code.

## Format

- One opaque `SDE2` container is designed to be embedded in the shell DEX.
- AES-256-GCM authenticates the header and encrypted payload.
- The authenticated plaintext is a length-prefixed sequence of DEX byte buffers.
- Entries have no APK-visible `classes2.dex` / `classes3.dex` names.
- The runtime can decrypt the sequence into byte buffers and pass them to
  `InMemoryDexClassLoader` on supported Android versions.
- Original DEX buffers are preserved independently; they are not merged into
  one conventional DEX and therefore do not hit the 65,536 method-reference
  ceiling caused by a naive merge.

## Development

```sh
python -m pip install -r requirements.txt
python -m unittest -v
```

The 32-byte content key is passed in by the future packager/runtime key bridge.
This module deliberately does not pretend that embedding a plaintext key in an
APK is secure. Production key provisioning and native integration are still
required.

## Not yet implemented

This is **not yet a complete APK protector**. The following milestones remain:
1. Compile the Java shell/loader into the replacement `classes.dex`.
2. Add the native key bridge and per-build key provisioning.
3. Replace original DEX entries with the shell and embedded SDE2 payload.
4. Preserve manifest/Application/component startup semantics and native libs.
5. Rebuild, zipalign, sign, install and launch-test protected APK fixtures.
6. Connect the validated worker to the anonymous online API.

Protection must remain disabled until those steps pass real-device tests.
