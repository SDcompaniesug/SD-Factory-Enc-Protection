import { pool } from '../../../../lib/auth';
import { requireUser } from '../../../../lib/require-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(req: Request) {
  const user = await requireUser(req.headers);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => null) as { originalKey?: unknown; sha256?: unknown } | null;
  if (!body || typeof body.originalKey !== 'string' || body.originalKey.length < 1 || body.originalKey.length > 1024 || typeof body.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(body.sha256)) {
    return json({ error: 'invalid_request', message: 'originalKey and SHA-256 are required' }, 400);
  }
  const result = await pool.query(
    `INSERT INTO sde_jobs(user_id,status,original_key,original_sha256) VALUES ($1,'uploaded',$2,$3) RETURNING id,status,created_at`,
    [user.id, body.originalKey, body.sha256.toLowerCase()]
  );
  return json(result.rows[0], 201);
}

export async function GET(req: Request) {
  const user = await requireUser(req.headers);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const result = await pool.query(
    `SELECT id,status,package_name,version_name,min_sdk,target_sdk,activities,selected_activities,protection_state,error_code,error_message,created_at,updated_at FROM sde_jobs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
    [user.id]
  );
  return json({ jobs: result.rows });
}
