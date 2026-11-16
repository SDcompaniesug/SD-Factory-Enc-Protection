#!/usr/bin/env node
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const base = (process.env.API_BASE_URL || '').replace(/\/$/, '');
const databaseUrl = process.env.FACTORYENC_DATABASE_URL;
if (!base || !databaseUrl) {
  console.error('Set API_BASE_URL and FACTORYENC_DATABASE_URL. The database URL is used only to remove temporary test accounts.');
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: true }, max: 1 });
const suffix = randomUUID().replace(/-/g, '').slice(0, 18);
const password = 'SdeTest-' + randomUUID() + '!aA9';
const users = [
  { name: 'Factory Enc Integration A', email: `factoryenc-test-a-${suffix}@example.invalid` },
  { name: 'Factory Enc Integration B', email: `factoryenc-test-b-${suffix}@example.invalid` }
];
const results = [];
let tokenA = '';
let tokenB = '';
let jobId = '';

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = 'Bearer ' + token;
  const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { status: response.status, data, headers: response.headers };
}
async function check(name, fn) {
  await fn();
  results.push(name);
  console.log('PASS ' + name);
}
function bearer(result) {
  return result.data?.token || result.headers.get('set-auth-token') || '';
}

try {
  await check('unauthenticated job list is rejected (401)', async () => {
    const r = await request('/api/v1/jobs');
    assert.equal(r.status, 401);
  });

  const registrations = [];
  for (const user of users) {
    const r = await request('/api/auth/sign-up/email', {
      method: 'POST',
      body: { name: user.name, email: user.email, password }
    });
    registrations.push(r);
  }
  await check('two independent accounts register successfully', async () => {
    for (const r of registrations) assert.ok(r.status === 200 || r.status === 201, 'registration failed: HTTP ' + r.status + ' ' + JSON.stringify(r.data));
  });

  const loginA = await request('/api/auth/sign-in/email', { method: 'POST', body: { email: users[0].email, password } });
  const loginB = await request('/api/auth/sign-in/email', { method: 'POST', body: { email: users[1].email, password } });
  tokenA = bearer(loginA);
  tokenB = bearer(loginB);
  await check('both accounts log in and receive bearer tokens', async () => {
    assert.equal(loginA.status, 200); assert.equal(loginB.status, 200);
    assert.ok(tokenA); assert.ok(tokenB); assert.notEqual(tokenA, tokenB);
  });

  await check('bearer tokens validate their respective sessions', async () => {
    const a = await request('/api/auth/get-session', { token: tokenA });
    const b = await request('/api/auth/get-session', { token: tokenB });
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    assert.equal(a.data?.user?.email, users[0].email);
    assert.equal(b.data?.user?.email, users[1].email);
  });

  await check('invalid bearer token is rejected', async () => {
    const r = await request('/api/v1/jobs', { token: 'not-a-valid-session-token' });
    assert.equal(r.status, 401);
  });

  const created = await request('/api/v1/jobs', {
    method: 'POST', token: tokenA,
    body: { originalKey: 'integration-tests/' + suffix + '/source.apk', sha256: 'a'.repeat(64) }
  });
  assert.equal(created.status, 201, 'job creation failed: ' + JSON.stringify(created.data));
  jobId = created.data.id;

  await check('owner can list and read their job', async () => {
    const list = await request('/api/v1/jobs', { token: tokenA });
    const detail = await request('/api/v1/jobs/' + jobId, { token: tokenA });
    assert.equal(list.status, 200);
    assert.ok(list.data.jobs.some(j => j.id === jobId));
    assert.equal(detail.status, 200);
    assert.equal(detail.data.id, jobId);
  });

  await check('another user cannot read the job (404)', async () => {
    const r = await request('/api/v1/jobs/' + jobId, { token: tokenB });
    assert.equal(r.status, 404);
  });

  await check('another user cannot see the job in their list', async () => {
    const r = await request('/api/v1/jobs', { token: tokenB });
    assert.equal(r.status, 200);
    assert.ok(!r.data.jobs.some(j => j.id === jobId));
  });

  await check('another user cannot alter Activity selection', async () => {
    const r = await request('/api/v1/jobs/' + jobId + '/selection', {
      method: 'POST', token: tokenB, body: { activities: ['com.example.HiddenActivity'] }
    });
    assert.ok(r.status === 404 || r.status === 409, 'unexpected cross-user selection response: ' + r.status);
  });

  await check('owner can save Activity selection', async () => {
    const r = await request('/api/v1/jobs/' + jobId + '/selection', {
      method: 'POST', token: tokenA, body: { activities: ['com.example.MainActivity'] }
    });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.selected_activities, ['com.example.MainActivity']);
  });

  await check('protection endpoint remains disabled (503)', async () => {
    const r = await request('/api/v1/jobs/' + jobId + '/protect', { method: 'POST', token: tokenA, body: {} });
    assert.equal(r.status, 503);
    assert.equal(r.data?.error, 'protection_engine_not_deployed');
  });

  console.log(`\nIntegration tests passed: ${results.length}`);
} catch (error) {
  console.error('INTEGRATION TEST FAILED:', error?.stack || error);
  process.exitCode = 1;
} finally {
  try {
    await pool.query('DELETE FROM "user" WHERE email = ANY($1::text[])', [users.map(u => u.email)]);
    console.log('Temporary test accounts cleaned up.');
  } catch (error) {
    console.error('WARNING: test account cleanup failed; manually remove the factoryenc-test-* accounts:', error?.message || error);
    process.exitCode = 1;
  }
  await pool.end();
}
