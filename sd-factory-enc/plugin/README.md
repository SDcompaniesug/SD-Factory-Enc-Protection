# MCP development interface

This is a **local stdio MCP server**, not a cloud-connected plugin. It exposes:

- `inspect_apk`: read-only APK inspection in a network-isolated, resource-limited Docker container.
- `protection_status`: explicit status; protection remains disabled until the native engine passes device tests.

Requirements: Node.js 20+, Docker Engine, and the Python worker image.

```sh
cd worker
docker build -t sd-factory-enc-worker:latest .
cd ../plugin
npm install
node server.mjs
```

Configure the MCP client from `mcp.json.template`, replacing the absolute path. The client must be able to run Node and Docker. Do not expose the Docker socket to an untrusted remote service.

The MCP server accepts a local APK path. It does not upload to Neon or dispatch cloud jobs.
