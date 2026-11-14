// Local MCP interface for development/testing. Cloud connection is configured
// only after the Neon Function has a real deployed URL.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';

const server = new McpServer({ name: 'sd-factory-enc', version: '0.1.0' });
server.tool('inspect_apk', 'Inspect an APK and list its package, SDK levels, DEX files, native libraries, and Activities. This does not protect or modify the APK.',
  { apk_path: z.string().min(1) }, async ({ apk_path }) => {
    await access(apk_path);
    const out = await new Promise((resolve, reject) => {
      const child = spawn('docker', ['run','--rm','-v',`${apk_path}:/input.apk:ro`,'sd-factory-enc-worker','/input.apk']);
      let stdout='', stderr=''; child.stdout.on('data',d=>stdout+=d); child.stderr.on('data',d=>stderr+=d);
      child.on('error',reject); child.on('close',code=>code===0?resolve(stdout):reject(new Error(stderr||`worker exited ${code}`)));
    });
    return { content: [{ type: 'text', text: String(out) }] };
  });
server.tool('protection_status', 'Report whether the real native protection engine is deployed. Never creates a fake protected APK.', {}, async () => ({
  content: [{ type: 'text', text: 'APK inspection is implemented. Native DEX transformation, encrypted runtime loading, com.sdfactory.enc bridges, and ARM32/ARM64 runtime validation are not yet deployed. Protection is disabled and fails closed.' }]
}));
await server.connect(new StdioServerTransport());
