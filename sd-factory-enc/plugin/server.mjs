// Local stdio MCP server. Inspection only; it never claims to protect APKs.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';

const server = new McpServer({ name: 'sd-factory-enc', version: '0.1.1' });
const IMAGE = process.env.SDE_WORKER_IMAGE || 'sd-factory-enc-worker:latest';
const MAX_OUTPUT = 2 * 1024 * 1024;
const TIMEOUT_MS = 120000;

async function runInspector(apkPath) {
  const absolutePath = path.resolve(apkPath);
  await access(absolutePath);
  const file = await stat(absolutePath);
  if (!file.isFile()) throw new Error('apk_path must point to a regular file');
  if (file.size <= 0 || file.size > 512 * 1024 * 1024) throw new Error('APK must be between 1 byte and 512 MiB');
  if (path.extname(absolutePath).toLowerCase() !== '.apk') throw new Error('apk_path must have an .apk extension');
  if (absolutePath.includes(',')) throw new Error('APK path cannot contain commas when using Docker mount syntax');
  return await new Promise((resolve, reject) => {
    const mount = `type=bind,src=${absolutePath},dst=/input.apk,readonly`;
    const args = ['run','--rm','--network','none','--read-only','--cap-drop','ALL',
      '--security-opt','no-new-privileges','--pids-limit','128','--memory','1g','--cpus','2',
      '--tmpfs','/tmp:rw,noexec,nosuid,size=64m','--mount',mount,IMAGE,'/input.apk','--json'];
    const child = spawn('docker', args, { stdio: ['ignore','pipe','pipe'], windowsHide: true });
    let stdout='', stderr='', settled=false;
    const finish=(fn,value)=>{ if(settled)return; settled=true; clearTimeout(timer); fn(value); };
    const timer=setTimeout(()=>{ child.kill('SIGKILL'); finish(reject,new Error('APK inspection timed out after 120 seconds')); },TIMEOUT_MS);
    child.stdout.on('data',chunk=>{ stdout+=chunk.toString(); if(stdout.length>MAX_OUTPUT){child.kill('SIGKILL');finish(reject,new Error('Worker output exceeded 2 MiB'));} });
    child.stderr.on('data',chunk=>{ stderr+=chunk.toString(); if(stderr.length>MAX_OUTPUT)stderr=stderr.slice(-MAX_OUTPUT); });
    child.on('error',error=>finish(reject,new Error(`Unable to start Docker worker: ${error.message}`)));
    child.on('close',code=>code===0?finish(resolve,stdout):finish(reject,new Error((stderr.trim()||`Worker exited with code ${code}`).slice(0,4000))));
  });
}

server.tool('inspect_apk','Read-only APK inspection: package, SDK levels, manifest Activities, DEX/native libraries and SHA-256. Does not modify or protect the APK.',
  { apk_path: z.string().min(1).max(4096) }, async ({apk_path}) => {
    try { return {content:[{type:'text',text:await runInspector(apk_path)}]}; }
    catch(error) { return {isError:true,content:[{type:'text',text:error instanceof Error?error.message:String(error)}]}; }
  });
server.tool('protection_status','Report whether the validated native protection engine is deployed.',{},async()=>({
  content:[{type:'text',text:'Protection is disabled. DEX transformation, encrypted runtime loading, com.sdfactory.enc Activity bridges, ARM32/ARM64 runtimes, APK rebuild/signing and device validation are not deployed.'}]
}));
await server.connect(new StdioServerTransport());
