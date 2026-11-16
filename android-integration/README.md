# Android API integration (Java)

Copy `FactoryEncApi.java` into the Android app's `app/src/main/java/com/factory/enc/` directory (package is exactly `com.factory.enc`). Add the Android permission below to the app manifest:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

The API client uses HTTPS, Better Auth bearer sessions, and AndroidKeyStore AES-GCM encryption for the saved session token. Network calls run off the UI thread; update views from the main thread in your callback.

Example:

```java
FactoryEncApi api = new FactoryEncApi(this);
api.login(email, password, new FactoryEncApi.Callback() {
    @Override public void onSuccess(final org.json.JSONObject session) {
        runOnUiThread(new Runnable() {
            @Override public void run() {
                // Open the signed-in screen.
            }
        });
    }
    @Override public void onError(final int code, final String message) {
        runOnUiThread(new Runnable() {
            @Override public void run() {
                // Show the error message.
            }
        });
    }
});
```

Available operations: register, login, validateSession, listJobs, createJob, getJob, saveActivitySelection, requestProtection, and logout.

**Important:** this is a drop-in Java API client, not a merge into the full app UI. The current repository did not contain the Android application source, so the actual login screen, upload flow, Activities list, job screens, and navigation have not been changed. Send the existing `com.factory.enc` Android project ZIP to complete that merge. Do not put database credentials or server secrets in the APK.

The protection endpoint is intentionally expected to return HTTP 503 until the engine has passed real Android device tests.
