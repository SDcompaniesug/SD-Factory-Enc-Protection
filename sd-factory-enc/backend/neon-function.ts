// Neon Function API source. Deploy as a Neon Function after the initial
// function-create operation is available. Uses the branch-injected DATABASE_URL.
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/health') {
      return json({ service: 'S.D Factory Enc API', status: 'ok', protectionEngine: 'not-installed' });
    }
    const expectedKey = process.env.SDE_API_KEY;
    if (!expectedKey || req.headers.get('authorization') !== `Bearer ${expectedKey}`) {
      return json({ error: 'unauthorized' }, 401);
    }
    if (req.method === 'POST' && url.pathname === '/v1/jobs') {
      const body = await req.json().catch(() => null) as any;
      if (!body || typeof body.originalKey !== 'string' || !/^[a-f0-9]{64}$/.test(body.sha256 || '')) {
        return json({ error: 'invalid_request', message: 'originalKey and SHA-256 are required' }, 400);
      }
      const result = await pool.query(
        `INSERT INTO sde_jobs(status, original_key, original_sha256)
         VALUES ('uploaded',$1,$2) RETURNING id,status,created_at`,
        [body.originalKey, body.sha256]
      );
      return json(result.rows[0], 201);
    }
    const match = url.pathname.match(/^\/v1\/jobs\/([0-9a-f-]{36})(?:\/(selection|protect))?$/i);
    if (req.method === 'GET' && match && !match[2]) {
      const result = await pool.query(
        `SELECT id,status,package_name,version_name,min_sdk,target_sdk,activities,
                selected_activities,protection_state,error_code,error_message,created_at,updated_at
         FROM sde_jobs WHERE id=$1`, [match[1]]
      );
      return result.rowCount ? json(result.rows[0]) : json({ error: 'not_found' }, 404);
    }
    if (req.method === 'POST' && match && match[2] === 'selection') {
      const body = await req.json().catch(() => null) as any;
      if (!body || !Array.isArray(body.activities) || body.activities.some((x: unknown) => typeof x !== 'string')) {
        return json({ error: 'invalid_selection' }, 400);
      }
      const result = await pool.query(
        `UPDATE sde_jobs SET selected_activities=$2, updated_at=now()
         WHERE id=$1 AND status IN ('ready','uploaded') RETURNING id,selected_activities`,
        [match[1], body.activities]
      );
      return result.rowCount ? json(result.rows[0]) : json({ error: 'job_not_selectable' }, 409);
    }
    if (req.method === 'POST' && match && match[2] === 'protect') {
      // Fail closed: no fake APK, fake progress, or false protection report.
      await pool.query(
        `UPDATE sde_jobs SET status='failed', protection_state='blocked_engine_missing',
         error_code='PROTECTION_ENGINE_NOT_DEPLOYED',
         error_message='The native DEX transformation and runtime loader engine has not passed validation.',
         updated_at=now() WHERE id=$1`, [match[1]]
      );
      return json({ error: 'protection_engine_not_deployed',
        message: 'APK inspection is available; protection is disabled until the native engine is deployed and device-tested.' }, 503);
    }
    return json({ error: 'not_found' }, 404);
  }
};
