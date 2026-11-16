package com.factory.enc;

import android.content.Context;
import android.os.Build;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

/**
 * Java-only client for the S.D Factory Enc API.
 * All network calls run on a worker thread. Callbacks also run on that worker thread.
 */
public final class FactoryEncApi {
    public static final String BASE_URL = "https://sd-factory-enc-api.vercel.app";
    private static final String KEY_ALIAS = "factory_enc_session_v1";
    private static final String PREFS = "factory_enc_secure_session";
    private static final String TOKEN_KEY = "bearer_token";
    private static final ExecutorService EXECUTOR = Executors.newFixedThreadPool(3);

    public interface Callback {
        void onSuccess(JSONObject result);
        void onError(int httpCode, String message);
    }

    private final Context appContext;

    public FactoryEncApi(Context context) {
        appContext = context.getApplicationContext();
    }

    public void register(final String name, final String email, final String password, final Callback callback) {
        execute(new RequestTask() {
            public JSONObject run() throws Exception {
                JSONObject body = new JSONObject();
                body.put("name", name);
                body.put("email", email);
                body.put("password", password);
                JSONObject signedUp = send("POST", "/api/auth/sign-up/email", body, false);
                String token = signedUp.optString("token", "");
                if (token.length() == 0) {
                    JSONObject signedIn = authSignIn(email, password);
                    token = signedIn.optString("token", "");
                    if (token.length() == 0) throw new ApiException(0, "Registration succeeded, but the API did not return a bearer token.");
                }
                SecureTokenStore.save(appContext, token);
                return getSessionNow();
            }
        }, callback);
    }

    public void login(final String email, final String password, final Callback callback) {
        execute(new RequestTask() {
            public JSONObject run() throws Exception {
                JSONObject result = authSignIn(email, password);
                String token = result.optString("token", "");
                if (token.length() == 0) throw new ApiException(0, "The sign-in response did not contain a bearer token.");
                SecureTokenStore.save(appContext, token);
                return getSessionNow();
            }
        }, callback);
    }

    private JSONObject authSignIn(String email, String password) throws Exception {
        JSONObject body = new JSONObject();
        body.put("email", email);
        body.put("password", password);
        return send("POST", "/api/auth/sign-in/email", body, false);
    }

    public void validateSession(final Callback callback) {
        execute(new RequestTask() {
            public JSONObject run() throws Exception { return getSessionNow(); }
        }, callback);
    }

    private JSONObject getSessionNow() throws Exception {
        JSONObject result = send("GET", "/api/auth/get-session", null, true);
        if (result == null || result.isNull("user") || result.optJSONObject("user") == null) {
            SecureTokenStore.clear(appContext);
            throw new ApiException(401, "Your session has expired. Please sign in again.");
        }
        return result;
    }

    public void listJobs(final Callback callback) {
        execute(new RequestTask() {
            public JSONObject run() throws Exception { return send("GET", "/api/v1/jobs", null, true); }
        }, callback);
    }

    public void createJob(final String originalKey, final String sha256, final Callback callback) {
        execute(new RequestTask() {
            public JSONObject run() throws Exception {
                JSONObject body = new JSONObject();
                body.put("originalKey", originalKey);
                body.put("sha256", sha256);
                return send("POST", "/api/v1/jobs", body, true);
            }
        }, callback);
    }

    public void getJob(final String jobId, final Callback callback) {
        execute(new RequestTask() {
            public JSONObject run() throws Exception { return send("GET", "/api/v1/jobs/" + jobId, null, true); }
        }, callback);
    }

    public void saveActivitySelection(final String jobId, final JSONArray activities, final Callback callback) {
        execute(new RequestTask() {
            public JSONObject run() throws Exception {
                JSONObject body = new JSONObject();
                body.put("activities", activities);
                return send("POST", "/api/v1/jobs/" + jobId + "/selection", body, true);
            }
        }, callback);
    }

    /** Deliberately returns HTTP 503 until the engine has passed real device tests. */
    public void requestProtection(final String jobId, final Callback callback) {
        execute(new RequestTask() {
            public JSONObject run() throws Exception { return send("POST", "/api/v1/jobs/" + jobId + "/protect", new JSONObject(), true); }
        }, callback);
    }

    public void logout() {
        SecureTokenStore.clear(appContext);
    }

    private interface RequestTask { JSONObject run() throws Exception; }

    private void execute(final RequestTask task, final Callback callback) {
        EXECUTOR.execute(new Runnable() {
            public void run() {
                try {
                    JSONObject result = task.run();
                    if (callback != null) callback.onSuccess(result == null ? new JSONObject() : result);
                } catch (ApiException e) {
                    if (callback != null) callback.onError(e.code, e.getMessage());
                } catch (Exception e) {
                    if (callback != null) callback.onError(0, e.getMessage() == null ? "Network request failed." : e.getMessage());
                }
            }
        });
    }

    private JSONObject send(String method, String path, JSONObject body, boolean authenticated) throws Exception {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(BASE_URL + path);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod(method);
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(20000);
            connection.setRequestProperty("Accept", "application/json");
            if (body != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            }
            if (authenticated) {
                String token = SecureTokenStore.read(appContext);
                if (token.length() == 0) throw new ApiException(401, "Please sign in first.");
                connection.setRequestProperty("Authorization", "Bearer " + token);
            }
            if (body != null) {
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                OutputStream output = connection.getOutputStream();
                output.write(bytes);
                output.flush();
                output.close();
            }
            int code = connection.getResponseCode();
            InputStream input = code >= 200 && code < 400 ? connection.getInputStream() : connection.getErrorStream();
            String response = readAll(input);
            JSONObject json;
            try { json = response.length() == 0 ? new JSONObject() : new JSONObject(response); }
            catch (Exception ignored) { json = new JSONObject(); }
            if (code < 200 || code >= 300) {
                if (code == 401) SecureTokenStore.clear(appContext);
                String message = json.optString("message", json.optString("error", "API request failed."));
                throw new ApiException(code, message);
            }
            return json;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String readAll(InputStream input) throws Exception {
        if (input == null) return "";
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int count;
        while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        input.close();
        return new String(output.toByteArray(), StandardCharsets.UTF_8);
    }

    private static final class ApiException extends Exception {
        final int code;
        ApiException(int code, String message) { super(message); this.code = code; }
    }

    private static final class SecureTokenStore {
        static void save(Context context, String token) throws Exception {
            if (Build.VERSION.SDK_INT < 23) throw new Exception("Android 6.0 or later is required for secure session storage.");
            SecretKey key = getOrCreateKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] encrypted = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
            byte[] iv = cipher.getIV();
            byte[] packed = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, packed, 0, iv.length);
            System.arraycopy(encrypted, 0, packed, iv.length, encrypted.length);
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                    .putString(TOKEN_KEY, Base64.encodeToString(packed, Base64.NO_WRAP)).apply();
        }

        static String read(Context context) throws Exception {
            String encoded = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(TOKEN_KEY, "");
            if (encoded.length() == 0) return "";
            byte[] packed = Base64.decode(encoded, Base64.NO_WRAP);
            if (packed.length < 29) { clear(context); return ""; }
            byte[] iv = new byte[12];
            byte[] encrypted = new byte[packed.length - 12];
            System.arraycopy(packed, 0, iv, 0, 12);
            System.arraycopy(packed, 12, encrypted, 0, encrypted.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        }

        static void clear(Context context) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(TOKEN_KEY).apply();
        }

        private static SecretKey getOrCreateKey() throws Exception {
            KeyStore store = KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            if (store.containsAlias(KEY_ALIAS)) return (SecretKey) store.getKey(KEY_ALIAS, null);
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setRandomizedEncryptionRequired(true)
                    .build());
            return generator.generateKey();
        }
    }
}
