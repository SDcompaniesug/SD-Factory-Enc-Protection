# S.D Factory Enc Protection

S.D Factory Enc is being developed as an online APK-protection service with a standalone Android client. The protection design is an independently implemented shell-and-encrypted-payload architecture inspired by the general architecture of Arkjiagu; it does not copy Arkjiagu source code.

## Agreed product scope

- Android client package: `com.factory.enc`
- Runtime package: `com.sdfactory.enc`
- Online backend performs protection; the Android client uploads and downloads APKs.
- No account registration or login in the initial free release.
- No VMP.
- The protected APK should expose one replacement `classes.dex` shell, with original DEX buffers encrypted inside one embedded payload container. No plaintext `classes2.dex`, `classes3.dex`, etc. are to remain in the protected APK.
- Original DEX buffers remain separate inside the authenticated payload and are loaded as buffers at runtime; they are not naively merged into one DEX.

## Current milestone

`source/engine/` contains the first SDE2 encrypted multi-DEX payload format implementation. `source/runtime/` contains a Java decoder for the same format. The payload format uses AES-256-GCM authentication and preserves ordered DEX buffers without exposing numbered DEX entries in the APK.

This is an engine-core milestone, **not a completed APK protector**. The shell DEX build, native key bridge, manifest/Application lifecycle integration, APK rebuild/signing, backend worker integration, and real-device tests remain outstanding. The API must continue to fail closed until those milestones pass.

## Tests

From `source/engine`:

```sh
python -m pip install -r requirements.txt
python -m unittest -v
```

Java decoder compile check:

```sh
javac -d out source/runtime/src/main/java/com/sdfactory/enc/PayloadDecoder.java
```

Only protect APKs you own or are explicitly authorized to process.